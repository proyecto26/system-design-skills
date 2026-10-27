---
description: Single-component question — the right block answers it directly; must NOT balloon into a full system design.
tags: [routing, building-block]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

For a web app's session cache in Redis (about 2M active sessions, sessions idle out after 30 minutes), should I use an LRU eviction policy or rely on TTLs? Keep it practical.
