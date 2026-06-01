I have all the building-block skills I need loaded: back-of-the-envelope, messaging-streaming (+ deep-dive), data-storage, consistency-coordination (+ deep-dive), api-design, and resilience-failure. Now I'll work the reasoning loop and write up the full design discussion.

---

# Designing WhatsApp — a collaborative system-design session

A quick framing before I draw anything: I'm going to treat each architecture as a *hypothesis* that holds until a number changes it. Round 1 is "make it correct for a sane number of users," Round 2 deliberately breaks that with 100B msg/day, and Round 3 goes deep on one hard problem. I'll narrate trade-offs as solves / worsens / when-to-change throughout, and I'll quantify before I pick anything.

---

## Round 1 — Core Design

### Clarify first (scope)

Before estimating, the questions whose answers actually change the design:

- **Is this 1:1 + small groups, or also broadcast/channels?** I'll scope to **1:1 chat and small groups (≤ a few hundred)** as core. Channels/broadcast lists, voice/video calls (WebRTC signaling), and status/stories are **out of scope** for Round 1.
- **Is the message body something the server can read?** For WhatsApp the answer is *no* — it's end-to-end encrypted, server stores ciphertext. I'll assume that, because it strongly shapes the data model (server can't index or search message content) but I'll defer the *key distribution* mechanics to Round 3.
- **What's the delivery contract?** This is the heart of it. WhatsApp's product promise is the checkmarks: one tick = stored at server, two ticks = delivered to recipient device, blue ticks = read. So the server must **persist every message durably, deliver reliably, and track per-message state**. The guarantee I'm committing to is **at-least-once delivery to each recipient device, with client-side dedup** — true exactly-once is not free (I'll justify this against the messaging-streaming skill below).
- **Media?** Photos/video/voice notes. These do *not* flow through the message path — they go to blob storage; the message carries a pointer + key. Out of scope to design the CDN deeply in R1, but I'll name it.

**Non-functional priorities, ranked:** (1) durability — never silently lose an accepted message; (2) low delivery latency when both parties online (sub-second feels "instant"); (3) availability over strong global consistency — a few seconds of ordering skew is fine, a lost message is not.

### Estimate scale (BOTEC)

Applying the back-of-the-envelope recipes. Let me pick *modest* Round-1 numbers so the design has somewhere to break in Round 2 — say **50M DAU**, ~40 messages sent per user per day.

- **Write QPS** = 50M × 40 ÷ 86,400 ≈ 2B ÷ 1e5 ≈ **~23,000 msg/sec average**. Peak factor ~2× → **~46k/sec peak**. (Already past a single RDBMS node at ~1k QPS, and past a single KV node at ~10k QPS — so even "modest" WhatsApp is a sharded/partitioned write problem from day one. Good, the number is doing the deciding.)
- **Read/fan-out**: 1:1 means each sent message → ~1 delivery. Groups multiply this; with mostly small groups call it a ~1.5–2× fan-out → ~50–90k delivery events/sec. Reads dominate writes only mildly here (unlike a feed); this is a **write-and-deliver-heavy** workload, not a read-heavy one.
- **Storage**: WhatsApp's real architecture *deletes messages from the server once delivered to all recipient devices* — the phone is the system of record, not the cloud. So server storage is dominated by the **undelivered queue** (offline recipients), not lifetime history. Average ciphertext message ~ a few hundred bytes + envelope ≈ **~1 KB**. If, say, 10% of messages are pending delivery at any time for a few hours, the hot store is on the order of low-single-digit TB — fits in a distributed store comfortably, and crucially it *drains*. This single product decision (server is a relay buffer, not an archive) is the most important storage choice in the whole design.
- **Connections**: this is the sleeper cost. If ~10M users are online concurrently, that's **10M simultaneous persistent connections**. At even ~1M connections/box (WhatsApp/Erlang famously pushed ~2M+), that's ~10–20 connection-gateway boxes for R1. Memory per idle connection (socket buffers + a little state) is the binding constraint, not CPU.

Takeaway from the numbers: this is **not a "store and query" system, it's a "route and buffer" system**. The DB is small and drains; the connection fleet and the message router are the real machinery.

### High-level design

```
                                    ┌─────────────────────────┐
 [mobile client] ──persistent TLS──▶│  Connection Gateway      │
   (WebSocket/                       │  (holds the socket;      │
    XMPP-style)                      │   1 row in session reg.) │
                                     └───────────┬─────────────┘
                                                 │
              ┌──────────────────────────────────┼───────────────────────────┐
              ▼                                   ▼                           ▼
     [Session Registry]               [Message Service]             [Presence Service]
     user/device → which               validates, assigns             online/last-seen
     gateway holds socket              msg_id, persists,              (soft state, TTL)
     (Redis, soft state)               routes/enqueues
                                               │
                          ┌────────────────────┼─────────────────────┐
                          ▼                                           ▼
                 [Message Store / Outbox]                    [Media: blob store + CDN]
                 per-recipient-device queue                  ciphertext blobs; msg carries
                 (wide-column, sharded by user)              pointer + decryption key
```

**API / transport.** Pulling the api-design skill's server-push tier: clients need *server→client push* (an incoming message can arrive any time), so polling is out — the math (N clients / interval T = mostly-empty requests) is wasteful at this connection count. I'll use a **persistent bidirectional connection (WebSocket, or an XMPP-like framing)**. The contract is a small framed protocol, not REST:

```
SEND   { client_msg_id, conversation_id, to_device_ids[], ciphertext, ts }      // client → server
ACK    { server_msg_id, status }                                                // server → client (the 1 tick)
DELIVER{ server_msg_id, conversation_id, from, ciphertext, ts }                 // server → client
RECEIPT{ server_msg_id, type: DELIVERED|READ, by_device }                       // either direction
```

`client_msg_id` is the **idempotency key** (api-design's owned mechanism) — a client UUID per logical message. If the SEND is retried after a network blip, the server dedups on `client_msg_id` and returns the *same* `server_msg_id` rather than creating a duplicate. This is what makes at-least-once *safe* on the send side.

**Data model.** Three concerns, three stores:

- **Users / devices** (relational or a KV by `user_id`): `user_id`, phone number, list of `device_id`s with their public-key bundles (the bundle matters in R3). Low write rate, integrity matters → a replicated SQL/KV store is fine.
- **Conversations / group membership** (relational): `conversation_id`, type (1:1 | group), and a `members` table (`conversation_id`, `user_id`, role). 1:1 conversations are implicit from the two user_ids. This is *small and read-mostly* — it's metadata, not the message firehose.
- **Messages / the outbox** — the firehose. Per the data-storage skill, the data model *is* the contract, so the key:

  > **Partition key = `recipient_device_id`**, **Sort key = `server_msg_id`** (a time-sortable ID — Snowflake-style: timestamp + shard + sequence).

  I deliberately key the message store by **recipient device, not by conversation**, because the dominant access pattern is *"give device D everything queued for it, in order, then delete once acked."* That's a point-partition + range-scan + delete — exactly wide-column's sweet spot (Cassandra/HBase/DynamoDB), and it shards evenly on a high-cardinality key. A row is written on send, range-scanned on (re)connect, and **deleted on delivery ack**. This is an **outbox / pending-queue**, not an archive.

  Why wide-column and not SQL here: the write QPS (~46k peak) is already 40× a single SQL node, the access pattern is a known key-range scan (no ad-hoc joins — the message body is opaque ciphertext anyway), and writes are append + delete. That's the textbook "writes are huge, queries are known up front" case the data-storage trade-off table points to. SQL stays where integrity and ad-hoc queries matter (users, groups).

### Delivery — end to end

The lifecycle of one message, online recipient:

1. **Send.** Alice's client pushes `SEND{client_msg_id, ...}` over her live socket to her Connection Gateway.
2. **Persist first, then route.** Message Service dedups on `client_msg_id`, assigns a monotonic `server_msg_id`, and **durably writes** the (ciphertext) message to the outbox keyed by Bob's `device_id`. *Only after the durable write* does it `ACK` Alice (one tick). Persist-before-ack is the whole ballgame: it's why an accepted message is never lost even if everything downstream crashes a millisecond later.
3. **Route.** Message Service looks up Bob in the **Session Registry** (Redis: `device_id → gateway_node` for currently-connected devices). If Bob is online, it forwards `DELIVER` to Bob's gateway, which writes it down Bob's socket.
4. **Delivered.** Bob's client, on receiving, sends `RECEIPT{DELIVERED}`. The server (a) **deletes the outbox row** for Bob's device (it's been delivered) and (b) relays the receipt back to Alice → two ticks.
5. **Read.** When Bob opens the chat, client sends `RECEIPT{READ}` → relayed to Alice → blue ticks. Read receipts are best-effort metadata; they can use a cheaper at-most-once path.

The flow is essentially a **per-recipient durable queue with a fast online bypass**: the outbox write is the source of truth; the live-socket forward is an optimization to get sub-second latency when the recipient is already connected.

### Online vs offline recipients

This falls straight out of the design above — it's the *same code path* with one branch:

- **Recipient online** (in Session Registry): forward to their gateway immediately. The outbox row still exists until they `ACK DELIVERED`, so a crash mid-delivery just means redelivery on reconnect — no loss.
- **Recipient offline** (not in Session Registry, or registry entry TTL-expired): the message **already sits in their per-device outbox**. Nothing special happens at send time — that's the elegance of persist-first. When Bob's device reconnects, his gateway registers him in the Session Registry and triggers a **sync**: range-scan the outbox `WHERE device_id = Bob ORDER BY server_msg_id`, stream everything down, await ACKs, delete acked rows.
- **Push wake-up.** If Bob's app is fully backgrounded/killed, there's no socket. The server hands off to **APNs/FCM** (a push notification) to wake the app, which then reconnects and runs the sync above. This is best-effort and decoupled (fire-and-react) — exactly the async hand-off the messaging-streaming skill describes; the durable outbox, not the push, is what guarantees delivery.

**Presence** (online/last-seen/typing) is explicitly **soft state**: a TTL'd key in Redis refreshed by heartbeats on the live connection. It's eventual and disposable — if the presence store hiccups, you show a slightly stale "last seen," which is a cosmetic degradation, not a correctness bug. I keep it on a separate service/store so its churn (every heartbeat) never touches the durable message path.

### Round 1 trade-offs (solves / worsens / when-to-change)

| Choice | Solves | Worsens | Change it when |
|---|---|---|---|
| Persistent WebSocket vs polling | Real server push, sub-second delivery, no empty-poll waste | Stateful connections — every box holds millions of sockets; reconnect storms; LB must do sticky/long-lived conns | Updates were rare → could poll. Not our case. |
| Outbox keyed by `recipient_device_id` (wide-column) | Even sharding, O(range-scan) sync per device, write throughput far past SQL | No ad-hoc/content queries (fine — ciphertext); cross-device of *one user* is N partitions | Need a server-side searchable archive → different model (but E2E encryption forbids it anyway) |
| Persist-before-ack | Durability: an accepted msg survives any downstream crash | Adds a storage write to the send latency budget | Never — this is the core guarantee |
| Delete-on-delivery (server as relay, not archive) | Tiny, self-draining hot store; cheap storage | History lives only on devices; lose your phone with no backup → lose history | Product wants server-side cloud history → add an (encrypted) archive tier |
| At-least-once + client dedup (not exactly-once) | Simple, no loss; matches messaging-streaming's "effectively once" default | Duplicates possible → client must dedup on `client_msg_id` | (Explored in R3) |
| Presence as TTL soft state, separate store | Heartbeat churn never touches durable path; cheap | Stale last-seen on hiccup | Presence must be exact (it never is for chat) |

### Stress-test (resilience-failure)

- **A gateway dies holding 1M sockets.** Those clients see a dropped connection and reconnect (with **jitter** — otherwise it's a thundering herd onto the remaining gateways and the Session Registry). On reconnect they land on a new gateway, re-register, and run the outbox sync. No messages lost because everything undelivered is still in the outbox. The risk to engineer for is the **reconnect storm**, not the data — bounded by client-side jittered backoff and gateway slow-start.
- **Message Service ↔ outbox store slow.** Persist-before-ack means a slow store *delays the one tick* rather than dropping the message. Timeout + bounded retry (idempotent on `client_msg_id`), and shed load with `429`-equivalent backpressure to clients if the store is genuinely overwhelmed — don't buffer unbounded in the gateway (messaging-streaming's backlog-hides-a-meltdown warning).
- **Session Registry (Redis) down.** Degrade gracefully: if we can't tell whether Bob is online, we *still wrote the outbox row*, so we fall back to "treat as offline" → he gets it on next sync + a push. Registry is an optimization, not a SPOF for correctness. Fail-open.
- **Duplicate sends** (Alice's client retried a timed-out SEND): dedup on `client_msg_id` at the Message Service → same `server_msg_id`, no duplicate row.

That's a correct, durable, latency-reasonable system for tens of millions of users. Now let's break it.

---

## Round 2 — Scale It (1B users, 100B msg/day, ~1.15M msg/sec peak)

### Re-estimate, then find where R1 breaks

Re-running BOTEC at the new numbers:

- **Write QPS** = 100B ÷ 86,400 ≈ **1.15M msg/sec average**; the prompt already gives peak ~1.15M, I'll treat sustained ~1.2M and spikes (New Year's midnight) much higher — call peak **~2–3M/sec** for sizing.
- **Connections**: 1B users, maybe **200–400M concurrently online**. At ~1–2M sockets/box that's **200–400+ connection-gateway boxes**, and they must be geo-distributed (a user in India shouldn't hold a socket to a US datacenter — that's a ~150ms cross-continent RTT on every frame, per the latency table).
- **Outbox writes**: ~1.2M/sec sustained, deletes at a similar rate as messages drain. Each is a small write to a partitioned store.

Now, **where does R1 break first?** In order:

1. **The Session Registry and the routing hop become the hottest path, not the DB.** Every single message does a `device_id → gateway` lookup. At 1.2M msg/sec that's >1.2M registry reads/sec. A single Redis is ~100k–1M QPS, so the registry itself must be **sharded by `device_id`** (consistent hashing — pulling consistency-coordination: `hash%N` would cause a remap storm every time a registry node scales, so use a hash ring with virtual nodes).
2. **Cross-gateway routing.** With 300 gateways, Alice on gateway-7 sending to Bob on gateway-211 needs gateway-7 → (find Bob) → gateway-211. Doing that as direct gateway-to-gateway RPC is an N² mesh. This is the first thing I'd restructure (below).
3. **Single-region everything.** A 1B-user product is global; one region means trans-continental latency for half the world and a single blast radius. R1 implicitly assumed one region — that assumption is now invalid.
4. **The outbox store** at 1.2M writes/sec — but this is actually the *easy* part: it was already sharded by `recipient_device_id` in R1, which is high-cardinality and even. We just need *more shards*: shard_count = peak_write_QPS ÷ per-node-QPS ≈ 1.2M ÷ 10k ≈ **~120+ shards** (round up generously for headroom and hot-key margin). The R1 key choice scales linearly here — that's the payoff of getting the partition key right early. No re-keying needed. Good.

So the design doesn't collapse — but the **routing layer** needs a real backbone, and we need to **go multi-region**.

### Restructured routing: a message router / bus

Replace direct gateway-to-gateway RPC with a routing tier:

```
 Alice ─socket─▶ [GW-7] ──┐                                  ┌── [GW-211] ─socket─▶ Bob
                          ▼                                  ▲
                   [Message Router]  ──persist outbox──▶ [Outbox store, ~120 shards]
                   (stateless, sharded                       (PK=recipient_device_id)
                    by recipient device)                      │
                          │                                   │ on deliver: delete row
                          └──lookup Session Registry──────────┘
                            (sharded, consistent-hash)
```

The gateway holds sockets only; the **stateless Message Router** (scaled horizontally behind its own LB) owns persist + lookup + forward. A gateway forwards an inbound SEND to *any* router instance; the router persists to the recipient's outbox shard, looks up the recipient's gateway in the (sharded) Session Registry, and forwards `DELIVER` to that one gateway. This turns N² into N→router→N, and lets routers and gateways scale independently (the messaging-streaming "scale producers and consumers separately" property).

Could I put **Kafka** between router and delivery instead of synchronous forward? Let me apply the messaging-streaming sync-vs-async test honestly: the recipient needs the message *as fast as possible*, and the durability is already handled by the outbox write — so inserting a broker on the hot online-delivery path mostly *adds latency* and a place to lag. Where a stream **does** earn its place at this scale is the **fan-out and side-effect plane**: push-notification dispatch, read-receipt fan-out, analytics, and **group fan-out** (next section). So: synchronous forward for the live 1:1 hot path (latency), async stream for fan-out/best-effort work (decoupling + buffering a spike). I won't name-drop Kafka on the path where a direct forward is simpler — that's the YAGNI guardrail.

### Multi-region

Per consistency-coordination's PACELC: strong global consistency would cost a cross-region round trip (~100ms+) on every message — unacceptable for "instant" chat, and unnecessary because **chat tolerates causal, not linearizable, consistency** (a reply must not precede its message; two unrelated messages racing by 50ms is invisible to humans).

So: **users are homed to a region** (by SIM/region), hold their socket and outbox there, and the message store is **single-leader per shard within a region** (AP-leaning across regions). A cross-region 1:1 (Alice in EU, Bob in US) routes EU-router → US-router → US-gateway; the one unavoidable cross-region hop happens once, asynchronously, and the outbox in Bob's region guarantees delivery. We choose **availability + causal ordering over global linearizability** — and I'd say so explicitly in the interview, because CAP forces the choice and pretending you get both is the #1 failure mode.

### Fan-out: group chat with 1,000 members

This is the sharp edge. A message to a 1,000-member group is **1 send → up to 1,000 deliveries**. The trade-off is the classic feed fan-out-on-write vs fan-out-on-read, now under E2E encryption.

**Fan-out-on-write (the right default here).** The sender (or the router) expands group membership and writes **one outbox row per recipient device**. For a 1,000-member group where everyone has ~1.5 devices, that's ~1,500 outbox writes + ~1,500 deliveries per single sent message.

- *Solves:* recipients still get the simple "scan my device outbox" sync — no change to the read path; offline members are handled identically to 1:1.
- *Worsens:* a **write amplification of 1,000×+**. If active groups produce even a few thousand messages/sec, that's millions of outbox writes/sec from groups alone. And it interacts badly with E2E encryption (below).

**Where it breaks and how I'd contain it:**

- **Hot partition / celebrity group** (data-storage + messaging-streaming both flag this exact shape): a very active 1,000-member group concentrates fan-out work. But note our **outbox is keyed by *recipient* device, not by group** — so the 1,000 writes spread across 1,000 partitions evenly. The hot spot is therefore not the store; it's the **fan-out worker** doing the expansion. Mitigate by making group fan-out an **async stream job** (this is exactly where the broker earns its place): the router writes *one* "group message accepted" event; a pool of fan-out workers consumes it and writes the N outbox rows, scaling workers to drain the backlog. Bound the queue and alarm on **consumer lag / oldest-message age** (messaging-streaming's single best signal) so a viral group degrades to "slightly delayed group delivery" rather than melting the cluster.
- **Encryption fan-out cost (the real WhatsApp twist).** Under the Signal protocol, naive E2E would require the sender to encrypt the message *separately for each of the 1,000 recipients' devices* — 1,000 encryptions per message, O(N) sender CPU and bandwidth. WhatsApp solves this with **Sender Keys**: the sender generates one symmetric group key, distributes it *once* to each member (pairwise-encrypted, O(N) but only when membership changes), then encrypts each *message* a single time with the sender key. So per-message sender cost drops to **O(1)**; the O(N) cost is paid only on membership change. The server still fans out the single ciphertext to N outboxes — but it's the *same* ciphertext copied N times, not N distinct encryptions. (Full key mechanics → R3 if chosen.)
- **Group size cap.** 1,000 is fine with sender-keys + async fan-out. This is *not* a Twitter-celebrity (millions of followers) problem, so I would **not** switch to fan-out-on-read (a pull model where members fetch from a per-group log). Fan-out-on-read would save writes but breaks the uniform per-device outbox sync, complicates offline delivery, and isn't needed at 1,000. I'd only revisit it if groups grew to **100k+ members (broadcast channels)** — at which point it genuinely becomes a different system (pub/sub fan-out-on-read from a per-channel log), and I'd say so rather than force the chat model to stretch.

### Round 2 trade-offs

| Choice | Solves | Worsens | Change it when |
|---|---|---|---|
| Stateless Message Router tier | Kills N² gateway mesh; independent scaling | Extra hop (~0.5ms intra-DC); router must be sharded for registry-lookup load | — |
| Sync forward on live 1:1 path, stream only for fan-out/side-effects | Lowest delivery latency where it matters; broker absorbs fan-out spikes | Two code paths | A blip shows the live path needs buffering → still prefer backpressure over unbounded queue |
| Region-homed users, causal (not linearizable) cross-region | Avoids ~100ms/write coordination; survives region partition (AP) | Cross-region chats take one async hop; no global total order | A feature needs a global invariant (rare in chat) → strong for *that* op only |
| Group fan-out-on-write + async workers | Uniform per-device sync; offline parity; drains a spike | 1,000× write amplification; fan-out worker is the hot spot | Group → 100k+ members → fan-out-on-read / pub-sub channel model |
| Sender Keys for group E2E | Per-message sender cost O(1) instead of O(N) | O(N) cost on membership change; re-key on member leave | — |

**Stress-test the scaled design:** the new failure mode is the **fan-out backlog** — if fan-out workers can't keep up (`consume_rate < produce_rate`, the backlog never drains per the messaging math), group delivery latency climbs invisibly. Defenses: depth + age alarms, autoscale workers on lag, and shed/slow group sends (not 1:1) under sustained overload. A **poison group message** (one recipient's outbox shard is down) goes to a DLQ with the envelope + attempt count so it doesn't head-of-line-block the other 999 deliveries — that's resilience-failure's DLQ-as-containment.

---

## Round 3 — Hard Problem (deep dive): **Message ordering across devices (multi-device sync)**

I'm picking this one because it's where chat's "feels simple" intuition collides hardest with distributed-systems reality, and it pulls together consistency-coordination (causal ordering, the consistency-model ladder) and messaging-streaming (per-key ordering). (I'll note the exactly-once and key-distribution options at the end, since they're entangled.)

### The problem, precisely

A user has **multiple devices** — phone, laptop, tablet, web — that must show **the same conversation in the same order**, and that order must respect causality (a reply never appears above the message it answers), *even though*:

- Messages arrive at each device via independent sockets, possibly out of order (different network paths, reconnects, redeliveries from at-least-once).
- The user can **send from any device**, and that send must appear consistently on all *their other* devices too (self-fan-out), not just on the recipient.
- Wall-clock timestamps are unreliable — device clocks skew by seconds; you cannot order a conversation by `now()` on the sender's phone.

What guarantee do we actually need? From the consistency-coordination ladder: **not linearizable** (too expensive, and humans can't perceive a global real-time total order anyway) and **not merely eventual** (eventual lets a reply show above its parent — visibly broken). The right target is **causal consistency**, plus **per-conversation monotonicity** on each device (a device never shows messages going *backward*). That's the precise contract.

### Mechanism 1 — per-conversation ordering via a sequence, not a clock

Order **per conversation** (the natural per-key from messaging-streaming — global order is unnecessary and would serialize the whole system). The server, which already assigns a `server_msg_id`, assigns a **monotonic per-conversation sequence number** at the moment it persists the message:

```
conversation_id  +  seq (monotonic int, gap-free per conversation)  →  total order within that conversation
```

Because all messages for one conversation funnel through a **single ordering authority** (the leader for that conversation's shard — single-leader per key, the common default from consistency-coordination), the server can hand out a clean, gap-free `seq`. Devices then **sort by `seq`**, not by timestamp. The wall-clock `ts` is display metadata only.

- *Why a server seq and not vector clocks for the common case:* 1:1 and group chat have a natural serialization point (the conversation's shard leader), so a simple monotonic counter gives total order per conversation cheaply — no vector-clock merge needed on the read path. Vector clocks are the tool when there's *no* single writer; here there is one per conversation.
- *Gap detection = monotonic reads:* a device tracks the highest contiguous `seq` it has rendered. If it receives `seq=42` but is missing `40,41`, it knows it has a hole (a redelivery arrived early, or a message is still in flight) and can **request a backfill** (range-scan its outbox / a per-conversation sync endpoint for `seq 40..41`) before rendering past the gap. This is how we get monotonicity despite at-least-once, out-of-order arrival.

### Mechanism 2 — multi-device as N independent delivery targets of one logical message

The key reframing: **each device is its own delivery endpoint with its own outbox** (recall R1's partition key is `recipient_device_id`, not `user_id` — this was deliberate setup for exactly this). One logical message to "Bob" becomes:

- Deliver to **all of Bob's devices** (so his laptop and phone agree), AND
- Deliver to **all of Alice's *other* devices** (self-sync — Alice's laptop must show the message she sent from her phone).

So a 1:1 message between two 2-device users is **4 outbox writes**, all carrying the **same `(conversation_id, seq)`**. Each device independently syncs its outbox, sorts by `seq`, backfills gaps, and converges on the identical ordered conversation. Multi-device sync is thus *not a special subsystem* — it's the per-device-outbox model from R1 plus a per-conversation `seq`. That's the elegant part: getting the partition key right in R1 made R3 mostly fall out.

### Mechanism 3 — sending from any device, and causal "reply-to"

- **Send from any device:** the sending device generates `client_msg_id` (idempotency/dedup) but **does not assign `seq`** — it can't, it doesn't know the other devices' state. It sends to the server; the conversation's shard leader assigns the authoritative `seq` and fans out to *all* devices including the sender's siblings. The sender's own device shows the message optimistically (pending), then reconciles to the server `seq` on ack. Two devices of Alice sending "simultaneously" are simply two writes the single leader serializes — it picks an order, and that order is what everyone (causally) sees. No conflict, because there's a single sequencer per conversation.
- **Causal reply-to across conversations / quotes:** when Bob replies quoting message `seq=40`, the reply carries `in_reply_to=40`. Even if delivery races, a device that has the reply but not `seq=40` knows (from the gap) to backfill before rendering — causality preserved by the same gap-detection mechanism. This is the causal-consistency guarantee from the deep-dive: cause→effect order is enforced; unrelated concurrent messages may briefly differ in micro-ordering across devices but converge.

### What this costs, and the failure modes (stress-test)

| Decision | Solves | Worsens | Change it when |
|---|---|---|---|
| Per-conversation server `seq` (single-leader per conversation shard) | Clean total order per conversation; cheap gap detection; no clock dependence | The conversation's shard leader is a per-key write bottleneck + ordering SPOF during failover | A single conversation's write rate exceeds one leader (huge group) → the leader serializes the group anyway; cap group size or relax to per-leader segments |
| Order by `seq`, timestamp is display-only | Immune to device clock skew | "Sent at" shown may slightly disagree with sort order on bad clocks (cosmetic) | — |
| Per-device outbox + self-fan-out | Multi-device sync reuses the 1:1 machinery; devices converge independently | Write/fan-out multiplied by total device count (sender's + recipients') | Device count per user explodes → cap linked devices (WhatsApp caps ~4 companions) |
| Causal (not linearizable) consistency | Avoids per-message global coordination round trip (~100ms) | Brief cross-device micro-ordering differences for *concurrent* messages | A global total order is ever required (it isn't for chat) |

**Failure modes I'd specifically defend against:**

- **Conversation leader failover (split-brain on the sequencer).** If two nodes both think they're the ordering authority for a conversation during a partition, they'd hand out conflicting `seq=41`s → divergent histories on different devices. Defense is straight from consistency-coordination: **majority-based election + fencing tokens** so a zombie old leader's `seq` assignments are rejected, and the sequence stays gap-free and single-valued. This is the one place I *do* need consensus-grade coordination — for the per-conversation ordering authority's election, not for the data plane.
- **At-least-once redelivery reordering.** A redelivered message arrives "in the past." The device's contiguous-`seq` watermark makes this a no-op (it's already rendered or it's a known duplicate via `client_msg_id`/`server_msg_id` dedup). At-least-once + dedup = the "effectively once" the messaging-streaming skill recommends over true exactly-once.
- **A device offline for a week.** It reconnects and must backfill a large `seq` range. Because the server **deletes outbox rows on delivery**, a long-offline device that the others already drained could find rows gone. WhatsApp's answer: the **other devices / the sender re-provide history on relink**, or a bounded server-side encrypted history window covers the gap. This is the explicit tension created by "server is a relay, not an archive" (R1) meeting multi-device — worth naming, because it's where the clean model has a real seam. The mitigation is a bounded retention window for undelivered-to-*some*-device messages, sized by how long a device may be dark.

### Why not the other two hard problems (brief, since they're entangled)

- **Exactly-once:** I'd argue *against* attempting true exactly-once and *for* **at-least-once + idempotent client dedup on `client_msg_id`/`server_msg_id`** — the messaging-streaming deep-dive is explicit that end-to-end exactly-once across independent systems is impossible in general, and "effectively once" via dedup is the portable, correct answer. Spending the interview building 2PC for message delivery would be a YAGNI red flag.
- **E2E key distribution at scale:** the genuinely deep version is the **Signal X3DH prekey-bundle** model — each device publishes a bundle (identity key + signed prekey + a stash of one-time prekeys) to a **key server**; a sender fetches the recipient's bundle to establish a Double Ratchet session *without* the recipient online; one-time prekeys get consumed and must be replenished (a replenishment-rate BOTEC: prekeys consumed/sec ≈ new-session-establishment rate, the server must alert a device to top up before its stash empties). At group scale, **Sender Keys** (R2) keep per-message cost O(1). The key server distributes *public* bundles only — it never sees private keys, so it's an availability/integrity component, not a confidentiality one. I'm happy to pivot to this if you'd prefer the crypto-distribution deep-dive over ordering.

---

## SKILLS CONSULTED

- **system-design** (orchestrator — reasoning loop, routing, guardrails)
- **back-of-the-envelope** (SKILL.md + references/numbers-to-remember.md — QPS, connection/storage sizing, shard-count = QPS ÷ per-node-QPS, latency table)
- **messaging-streaming** (SKILL.md + references/deep-dive.md — delivery guarantees, at-least-once + idempotency, per-key ordering, fan-out, DLQ, backlog-as-meltdown, sync-vs-async)
- **data-storage** (SKILL.md — wide-column vs SQL, partition/sort key design, hot-shard, sharding math)
- **consistency-coordination** (SKILL.md + references/deep-dive.md — CAP/PACELC, causal vs linearizable, single-leader sequencing, leader election/fencing/split-brain, consistent hashing)
- **api-design** (SKILL.md — server-push tier polling→WebSocket, idempotency-key contract, error/receipt shapes)
- **resilience-failure** (SKILL.md — reconnect/thundering-herd, fail-open degradation, retry budgets, DLQ-as-containment)