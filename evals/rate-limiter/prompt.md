---
description: Leads with resilience-failure + sharded-counters + api-design; the hot-key problem is the crux.
tags: [design, building-block]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Design a rate limiter for our public API. It runs across 100 gateway nodes handling 1M requests/sec in total, and each API key has a single global limit (e.g. 1,000 req/min). How do you keep the counts accurate without a hot key, and what do clients see when they're limited?
