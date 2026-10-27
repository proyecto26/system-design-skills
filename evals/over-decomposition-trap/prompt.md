---
description: Ceiling-breaker — the "impressive" microservices + Kafka answer is the wrong first move at this scale.
tags: [design, service-decomposition]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

We're a 6-engineer startup doing about 2,000 orders/day. Design the backend for order management: place order, track status, basic inventory. Our CTO wants microservices from day one — separate order, inventory, payment, and notification services talking over Kafka — so we're "ready to scale". What do you recommend?
