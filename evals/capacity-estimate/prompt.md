---
description: Pure estimation — numbers must be right and units shown.
tags: [building-block, estimation]
max_turns: 15
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

Quick capacity check for a chat app: 100M daily active users, each sends 40 messages a day, average message 1 KB including metadata, and we keep messages for 5 years. Peak traffic is 3× the average. What's the average and peak write QPS, how much storage per day and over 5 years (before replication), and what does that imply for the database choice?
