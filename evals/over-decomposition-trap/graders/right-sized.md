---
type: llm
weight: 3
---

PASS only if ALL of these hold:
1. Recommends starting with a modular monolith (or a small number of services) backed by a single relational database, and explicitly pushes back on microservices + Kafka from day one.
2. Grounds the pushback in the stated numbers: ~2k orders/day is a tiny load (well under 1 write/sec on average) that one database and one deployable handle easily, and 6 engineers cannot absorb the operational cost of many services.
3. Names the concrete costs of the premature split (distributed transactions / sagas for order+inventory, network failure modes, deploy/observability overhead, eventual consistency on inventory).
4. Gives an evolution path: clear module boundaries now, and specific signals or thresholds that would justify extracting a service later (team growth, independent scaling needs, deploy contention).

FAIL if it designs the four-service Kafka architecture as the primary recommendation, or agrees with the CTO without quantifying the load.
