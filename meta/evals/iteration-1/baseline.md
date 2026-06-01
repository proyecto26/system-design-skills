This is a system design interview exercise, not a coding task. I'll work through it as a collaborative design discussion. No tools needed here. Let me give a thorough, structured answer across all three rounds.

---

# WhatsApp System Design

## Round 1 — Core Design

### Clarifying scope first
Before designing, I'd pin down a few things with the interviewer: 1:1 and group text messaging, delivery/read receipts, presence (online/last-seen), and offline delivery. Media (images/video) and voice/video calls I'd flag as out of scope for the core but mention where they'd plug in. Key product invariant for WhatsApp specifically: **the server is a relay, not a store of record** — messages are deleted from the server once delivered. That shapes everything below.

### Data model

**Users**
```
users: { user_id (PK), phone_number (unique), display_name,
         public_keys..., created_at, last_seen }
devices: { device_id (PK), user_id (FK), push_token, platform,
           last_active }
```
Phone number is the natural identity key. A user can have multiple devices (relevant in Round 3).

**Conversations**
```
conversations: { conv_id (PK), type (1:1 | group), created_at }
conversation_members: { conv_id, user_id, role, joined_at }   # PK (conv_id, user_id)
```
For 1:1, conv_id can be a deterministic hash of the two user_ids so we never create duplicates.

**Messages** — this is the interesting part. Because the server is a relay, there are really two distinct stores:

1. **Undelivered message queue (hot, transient):** per-recipient-device inbox. This is the only place a message lives server-side, and only until ACKed.
```
inbox: { recipient_device_id, message_id, sender_id, conv_id,
         payload (ciphertext), seq, created_at }
```
Best modeled in a wide-column store (Cassandra/ScyllaDB) or a durable queue, partitioned by `recipient_device_id` so each device drains its own queue.

2. **Message metadata for ordering/dedup:** a monotonic `message_id` per message. I'd use a Snowflake-style 64-bit ID (timestamp + sender/shard bits + sequence) so IDs are roughly time-sortable and globally unique without coordination. The chat history itself lives **on the client devices**, not the server — that's the WhatsApp model. (Telegram/Messenger differ here; worth calling out the tradeoff.)

### Delivery — end to end

The connection layer is the heart of it. Clients hold a **persistent connection** (WebSocket, or in WhatsApp's case a long-lived TCP connection running a variant of XMPP). I'll say WebSocket for generality.

Flow for Alice → Bob, both online:
1. Alice sends `MSG` over her WebSocket to whichever **connection server (gateway)** she's pinned to.
2. Gateway assigns/accepts the `message_id`, persists the message to Bob's inbox (durability first — never lose an accepted message), then immediately **ACKs to Alice** → her client shows the single check ("sent to server").
3. Gateway needs to find Bob. Bob's device → which gateway is he connected to? That's a **session registry**: a fast key-value store (Redis) mapping `device_id → gateway_id`, kept fresh via heartbeats. Alternatively a pub/sub channel per device.
4. Gateway routes the message to Bob's gateway, which pushes it down Bob's WebSocket.
5. Bob's client ACKs receipt → gateway deletes from Bob's inbox, and relays a **delivery receipt** back to Alice → double check.
6. When Bob opens the chat, client sends a read receipt → Alice sees blue checks.

The two-phase ACK (server-ack to sender, then delivery-ack from recipient) is what powers the check-mark UX and guarantees we don't drop accepted messages.

### Online vs offline

The session registry tells us instantly whether Bob has a live connection.
- **Online:** push immediately (step 4 above).
- **Offline:** the message simply stays in Bob's inbox queue (it's already durably written). When Bob reconnects, the gateway **drains his inbox in `seq` order** and streams everything down, then he ACKs and we purge. To wake an offline device that's been killed by the OS, we send a **push notification** (APNs/FCM) — for E2E systems this is just a "you have messages, wake up and pull" nudge, not the content itself.
- **Presence/last-seen:** derived from heartbeat liveness in the session registry, published via pub/sub to interested contacts (with privacy settings gating who sees it).

That's a working single-region design. Let me stress it.

---

## Round 2 — Scale It

**Numbers:** 1B users, 100B msg/day. Average ~1.15M msg/sec, and chat is **peaky** (evenings, time zones, New Year's spikes) so I'd design for ~3M msg/sec peak. Connections are the dominant resource: potentially **hundreds of millions of concurrent persistent connections**.

### Where Round 1 breaks first

1. **Connection layer is the #1 constraint.** Each gateway can hold maybe ~500K–1M idle connections (tuned epoll/kqueue, but memory per connection and FD limits bite). 500M concurrent connections → ~500–1000 gateway boxes minimum, before headroom. This is the famous WhatsApp/Erlang story — they ran ~2M connections per box on FreeBSD. Gateways must be **dumb and stateless beyond the socket** so we can scale them horizontally and lose one without data loss.

2. **Session registry hot path.** At 3M msg/sec, every message does ≥1 "where is the recipient?" lookup. A single Redis can't take that. → **Shard the registry by device_id** (consistent hashing), replicate for reads. Or skip the central registry entirely and route via a **per-device pub/sub topic** on a sharded message bus; gateways subscribe to topics for their locally-connected devices.

3. **Inbox store write throughput.** Every message is a durable write. → Cassandra/Scylla partitioned by `recipient_device_id`, which spreads writes uniformly. TTL on rows so anything delivered-and-purged or abandoned doesn't accumulate. This scales near-linearly with nodes; it's the easy part.

4. **Single region = latency + blast radius.** → Multi-region. Pin users to a **home region** near them. Cross-region messages hop backbone between gateways. Session registry is regional; a global directory maps user → home region.

So the revised architecture: stateless **gateway tier** (just sockets) → **routing/message tier** (assigns IDs, writes inbox, resolves sessions, fans out) → **sharded inbox store** + **sharded session registry** + **pub/sub bus** → **push service** for offline wake-ups.

### Group chats with 1,000 members — fan-out

This is where naive designs die. Options:

- **Fan-out on write (server explodes the message):** sender sends once; server looks up all 1000 members, and for each member's each device writes to their inbox / pushes to their gateway. One inbound message → ~1000+ writes. For a chatty 1000-person group this is a lot, but it's the right default because **reads must be instant** and most members are different people on different shards. WhatsApp caps group size (historically 256, later 1024) precisely to bound this fan-out.

- **Fan-out on read (shared timeline):** store the message once in a group log; members pull. Saves writes but breaks the relay/push model, hurts the real-time "message arrives instantly" feel, and creates a read hotspot on popular groups. Bad fit for chat.

I'd go **fan-out on write**, with these refinements:
- **Decouple via a queue.** Sender's gateway accepts the message, ACKs the sender immediately, and drops one "group send" job onto a **fan-out worker queue**. Workers expand membership and write to each recipient inbox. This keeps the sender's latency flat regardless of group size and lets fan-out absorb bursts.
- **Per-device, not per-user.** Fan out to each member's devices (Round 3 multi-device concern).
- **Membership caching.** Cache group membership lists hot so expansion doesn't hammer the conversations DB on every message.
- **E2E twist (real WhatsApp):** with Signal's **Sender Keys**, the sender encrypts the message body *once* with a group sender key; the server still fans out the *same ciphertext* to all members (cheap, no per-recipient re-encryption). Key distribution is pairwise but only happens on membership change. This is what makes 1000-member E2E groups affordable — I'd flag it now and it sets up Round 3.

Backpressure: if a fan-out worker is behind, messages sit durably in the inbox store; recipients just see slightly higher latency rather than drops.

---

## Round 3 — Hard Problem (deep dive)

I'll pick **message ordering across devices / multi-device sync**, because it's the one most users feel daily (phone + laptop + tablet) and it interacts with everything above. I'll touch E2E key distribution at the end since they're entangled.

### The problem

A user has N devices (phone = primary, plus web/desktop/tablet). We need:
1. Every device sees the **same conversation in the same order**.
2. A message sent from *any* device appears on the user's *other* devices ("self-sync"/echo).
3. Read state, deletes, edits, and "delivered" state converge across devices.
4. Devices go offline independently and must catch up correctly on reconnect.
5. (WhatsApp-specific) The historical design tethered everything to the phone; the modern multi-device design makes each device a **first-class endpoint**.

### Why ordering is hard
There's no single global clock. Two messages sent nearly simultaneously from different senders can arrive at different devices in different orders. And a user's own devices must agree even though each pulled messages independently.

### Ordering model

I'd **not** rely on wall-clock timestamps for ordering (clock skew). Instead:

- **Per-conversation sequence number.** Define order *within a conversation*, which is all users actually perceive. Assign a monotonic `conv_seq` at a single serialization point per conversation. Options for that point:
  - A **per-conversation sequencer** (the message tier shard that owns `conv_id` stamps an incrementing seq). Gives a total order per conversation cheaply. Conversation is sharded by `conv_id`, so one owner exists at a time.
  - Snowflake IDs give *approximate* global time order for cross-conversation list sorting (which chat floats to top of the chat list), which doesn't need to be strict.

- **Causal ordering with vector/Lamport clocks** as a refinement when strict per-conv sequencing is too expensive or partition-prone: attach a logical clock so devices can at least preserve happens-before. In practice the per-conversation seq from a single owner is simpler and sufficient — I'd lead with that and mention vector clocks as the fallback for multi-master/offline-edit scenarios.

Within these, ties (same logical position) break deterministically by `(timestamp, message_id)` so **every device computes the identical order independently**. That determinism is the key: order isn't "what arrived first," it's "what the deterministic sort says," so late-arriving messages get inserted into their correct slot, not appended.

### Multi-device sync mechanics

Treat the user's account as having a **shared, append-only log of "thread events"** (message sent, message received, read, delete, reaction). Each device maintains a cursor into this log.

- Every device that's a member of a conversation is an **independent recipient**: fan-out (Round 2) targets `device_id`, so all of Alice's devices get the message into their own inbox queues with the same `(conv_id, conv_seq)`.
- **Self-send echo:** when Alice's phone sends, the server also fans the message out to Alice's *other* devices (laptop, tablet) so they show "you sent this." Sender's own device already has it locally; the server just makes sure the siblings get it.
- **Catch-up on reconnect:** each device tracks the highest `conv_seq` it has per conversation (a cursor / high-water mark). On reconnect it tells the server its cursors; server streams everything above them from the inbox/log. Because order is deterministic, the device merges and re-sorts locally — no "messages out of order" even if it was offline for a week.
- **Convergence of state (read/delete/edit):** model these as **CRDT-style** operations rather than overwrites. Read receipts = a max() over a monotonic read-cursor (last-read seq), trivially convergent. Deletes = tombstones. Edits = last-writer-wins keyed by `(conv_seq, edit_seq)`. This way two devices acting concurrently while one is offline still converge to the same state.

### The E2E entanglement (key distribution at scale)

Multi-device + E2E is where it gets genuinely hard, and it's worth naming:

- In Signal/WhatsApp, encryption is **pairwise per device**, not per user. With N devices each side, a 1:1 chat is an N×M mesh of Signal sessions. A message must be encrypted separately for each recipient device (and each of the sender's own other devices for echo).
- This means the server **cannot** decrypt to re-order or merge — all ordering metadata (`conv_seq`) must be on the *envelope* (plaintext routing header), while the body stays ciphertext. So my sequencer stamps the envelope, not the content. Good — the design above already separates routing metadata from payload.
- **Key distribution:** each device publishes a bundle of **prekeys** to the server (a "key directory"). To start/continue a session with a new device, you fetch its prekey bundle. Adding a device → it publishes keys → peers lazily establish sessions on next message. The server is an **untrusted key directory**; trust comes from **safety-number / QR verification** between users, and ideally **key transparency** (append-only, auditable key log, à la CONIKS/Key Transparency) so a malicious server can't silently inject a device. This is the real "at scale" challenge: serving billions of prekey fetches and detecting/limiting malicious device additions.
- **Sender Keys for groups** (from Round 2) sit on top: each device shares a per-device sender key with the group via pairwise Signal sessions once; thereafter group messages are encrypted once and fanned out — so multi-device E2E groups stay O(devices) on membership change, not per message.

### Failure modes I'd want to defend
- **Device removed/compromised:** revoke its sender keys, force re-keying of all groups it was in (forward secrecy limits exposure).
- **Lost cursor / corrupted local DB:** device re-bootstraps from primary device or from server-held (encrypted) backup; ordering still converges because it's deterministic.
- **Sequencer owner failover:** `conv_seq` must survive failover — persist the counter (Raft/consensus per shard or a durable atomic counter) so we never reissue a seq. A gap is fine (clients sort by value), a *duplicate* seq is not.

---

### Summary of the through-line
- Round 1: server is a **relay** with per-device inbox queues, persistent connections, two-phase ACK, push for offline.
- Round 2: **connections** break first → stateless gateway tier + sharded session registry + sharded inbox store + multi-region; groups use **queue-decoupled fan-out-on-write**, bounded by max group size, made cheap under E2E by Sender Keys.
- Round 3: ordering = **per-conversation monotonic seq from a single serialization point + deterministic tie-break + per-device cursors**, state convergence via **CRDT-style ops**, all carried on the **plaintext envelope** so it survives E2E; multi-device E2E rests on a **prekey directory + key transparency**.

I'd be happy to go deeper on any branch — e.g., the gateway connection-handling internals, the consensus choice for the per-conversation sequencer, or the key-transparency log design.