---
description: Open-ended design — should run the clarify → estimate → design → trade-offs → failure loop, not dump a memorized diagram.
tags: [design, orchestrator]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Design a URL shortener — short link in, original URL out, with redirects. Assume it grows to billions of redirects per day and ~10k new links per second. Walk me through the design.
