---
title: AI assistant
description: Turn on the AI assistant for the instance.
sidebar:
  order: 14
---

People can connect an AI client they run themselves to TTX-Zone, to help design an exercise or write its report. No model runs in TTX-Zone and no conversation is stored here. [The user guide](/guide/ai-assistant/) explains what it does.

It's off by default.

## Turn it on

Use **Instance administration → AI assistant**, or set `ASSISTANT_ENABLED` to pin it. There's one switch for the instance, with none per role or per exercise.

Turning it off stops every token at once. Tokens that haven't expired work again if it's turned back on.

:::caution
No data is filtered. What a client reads leaves your server for the AI provider that person's client uses, under that provider's terms. Decide whether that's acceptable for your exercise material before turning it on. Each person also has to acknowledge a responsible-use notice to create a token.
:::

## What's recorded

The same page lists the last 100 tool calls: when, who, through which token, which tool, how it ended and how long it took. Arguments and results are never recorded. Call records are kept 90 days.

Creating and revoking tokens are authentication events in the [activity log](/instance/logs-and-activity/).

## Limits

- `ASSISTANT_RATE_LIMIT_PER_MINUTE`: tool calls per token per minute, default 60.
- At most 5 active tokens per account, for at most 90 days.
- Changing a password or ending sessions revokes the account's tokens.

The endpoint isn't on [the public face](/instance/deployment-models/#model-2-exercise-with-external-players).
