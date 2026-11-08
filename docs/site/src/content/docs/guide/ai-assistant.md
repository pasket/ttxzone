---
title: AI assistant
description: Use an AI client to help design an exercise or write its report.
---

You can connect an AI client you run yourself, such as Claude Desktop, to TTX-Zone. It helps you build an exercise and write its after-action report, and never takes part in the live session. Your instance administrator has to [turn it on](/instance/ai-assistant/).

No model runs in TTX-Zone, and the conversation stays in your client.

:::caution
What your client reads leaves the server for your AI provider, under that provider's terms. Respect the exercise's TLP label, and your organization's rules.
:::

## What it can do

It acts as you, so it reaches only what you can.

- **Read** the exercises you plan, their needs analysis and MSEL.
- **Search** the knowledge base, the inject and objective catalogs, MITRE ATT&CK and your organization's library.
- **Read** the session plan and what's left before each document can move on.
- **Start from a scenario** of the Library and adapt it, and **remember**: past exercises' reports and the improvement plan, to learn from what happened before.
- **Propose** needs, objectives, the MSEL's phases, simulated actors and threat actors, injects, polls, the session plan's observation points and parts of the report.

It never changes anything by itself. Each proposal waits on the form's page under **AI proposals**, for you to accept it into the draft or discard it. Accepting has the form's usual effects: a ready MSEL reopens, for example.

When proposals wait for you, the assistant's spark appears at the top right with how many; click it to see where they are and go there. Each page also says what waits on the others. The numbers beside the Design menu's sections are something else: what each document still needs fixed before it can move on.

Proposals on the same row, such as three changes to one inject, are grouped under it, with what they do together shown first: tick the ones you want and accept or discard them together. Proposals that add to the same list, such as recipients, add up rather than replace each other. If saving a proposal would make the form warn about something, the warning is shown in the form's own words. When several are waiting, **Accept all** takes them in one step (a ready MSEL asks once) and **Discard all** clears them. A long list shows each proposal's title and reason, with its changes one click away.

It can propose the exercise's presentation, its name, description and content language, which you accept on the exercise's page and save from its edit form, and its TLP, always as a proposal in the needs analysis since it decides how the exercise's information is handled. It can also propose the scope (the participating areas every inject's recipients must belong to) and propose deleting rows, such as a duplicated inject; a deletion is accepted like any other proposal. Before proposing, it can measure what a change would do, how many warnings it adds and how many it resolves, without leaving anything for you to review.

It can propose resetting the MSEL's codes to its order after deletions leave gaps; accepting it runs the same reset as the button on the MSEL, while it's a draft.

On the MSEL it can also propose an inject's expected actions anew, where a contingent inject branches off and rejoins, the MSEL's own settings and its impact meters. A newer proposal on the same fields replaces an older one, so you don't review outdated versions.

It can build an MSEL from an empty one: it proposes the phases and actors first, then injects on them. Accepting an inject brings the phase and actors it needs with it, and discarding a phase discards the injects that need it.

## Guided flows and attachments

Your client's menu offers guided flows that know which steps to take: design an exercise from a scenario, build the MSEL, review before READY, prepare the evaluation, draft the after-action report, and lessons from past exercises. Each asks for the exercise; type part of its code or name and pick it from the suggestions.

It can also name a set of proposals, such as "Close MSEL v5": the set shows together on the page, to accept or discard at once. Every answer about an exercise reminds it of the exercise's TLP. Accepting or discarding a proposal is recorded in the activity log, without its content.

Ask it what's left to finish a document: it answers with ordered steps, those it can propose and those only you can take, and where. The *Close a document* flow takes it as far as proposals can.

You can also attach an exercise's documents to the conversation (its needs analysis, MSEL, session plan or after-action report), or a knowledge base entry or scenario, the same way you'd attach a file.

## Connect it

1. Open **Preferences → AI assistant** and acknowledge the responsible-use notice.
2. Create a token, for 7, 30 or 90 days. It's shown once.
3. Copy the configuration on that page into your client. It looks like this:

   ```json
   {
     "mcpServers": {
       "ttx-zone": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "https://ttx.example.org/api/v1/mcp", "--header", "Authorization:${TTX_ZONE_AUTH}"],
         "env": { "TTX_ZONE_AUTH": "Bearer ttxz_..." }
       }
     }
   }
   ```

It needs Node.js on your machine. If your instance uses your organization's own certificate authority, point Node.js at it with `NODE_EXTRA_CA_CERTS` in the same `env` block.

## Tokens

You can have five active at a time, and revoke them from the same page. Changing your password or ending your sessions revokes them too.
