---
title: AI assistant
description: Use an AI client to help design an exercise or write its report.
---

You can connect an AI client you run yourself, such as Claude Desktop, to TTX-Zone. It helps you build an exercise and write its after-action report, and never takes part in the live session. Your instance administrator has to [turn it on](/instance/ai-assistant/), and your organization chooses the roles it's on for in [Admin → Organization](/guide/administration/).

No model runs in TTX-Zone, and the conversation stays in your client.

:::caution
What your client reads leaves the server for your AI provider, under that provider's terms. Respect the exercise's TLP label, and your organization's rules.
:::

## What it can do

It acts as you, so it reaches only what you can.

- **Read** the exercises you plan, their needs analysis and MSEL, down to one inject in full.
- **Search** the knowledge base, the inject and objective catalogs, MITRE ATT&CK and your organization's library.
- **Read** the session plan and what's left before each document can move on, and a review of the design as a whole: what each objective has hanging from it, what's missing, where the session goes quiet.
- **Read** what your Exercise Program Manager wrote about the organization (its sector, regulators, technologies and critical assets), so what it proposes fits it.
- **Start from an exercise template** of the Library and adapt it, and **remember**: past exercises' reports and the improvement plan, to learn from what happened before.
- **Propose** needs, objectives, the needs analysis' context and risks, the MSEL's phases, simulated actors and threat actors, injects, polls, values for a template's placeholders, the session plan's observation points and parts of the report.

It never changes anything by itself. Each proposal waits on the form's page under **AI proposals**, for you to accept it into the draft or discard it. Accepting has the form's usual effects: a ready MSEL reopens, for example. The first proposal shows what it changes; the others show their title and summary, with the changes one click away. Once an accepted proposal is in the form, a notice says so: it saves with the form.

When proposals wait for you, the assistant's spark appears at the top right with how many; click it to see where they are and go there. Each page also says what waits on the others. The numbers beside the Design menu's sections are something else: what each document still needs fixed before it can move on.

Proposals on the same row, such as three changes to one inject, are grouped under it, with what they do together shown first: tick the ones you want and accept or discard them together. Proposals that add to the same list, such as recipients, add up rather than replace each other. If saving a proposal would make the form warn about something, the warning is shown in the form's own words. When several are waiting, **Accept all** takes them in one step (a ready MSEL asks once) and **Discard all** clears them. A long list shows each proposal's title and reason, with its changes one click away.

It can propose the exercise's presentation, its name, description and content language, which you accept on the exercise's page and save from its edit form, and its TLP, always as a proposal in the needs analysis since it decides how the exercise's information is handled. It can also propose the scope (the participating areas every inject's recipients must belong to) and propose deleting rows, such as a duplicated inject; a deletion is accepted like any other proposal. Before proposing, it can measure what a change would do, how many warnings it adds and how many it resolves, without leaving anything for you to review.

In the needs analysis it can also propose the context it can't be approved without (why the exercise, what prompted it, the levels that take part, the date window, the stop keyword) and the risks to the exercise itself with their mitigation. Your sponsor's name and role, the approvals and the commitment to act on the findings stay with you.

An inject can come with the artifact it's drawn as for the table (an email, a press release, a social media post or a chat message, with its sender and subject), a description of what would be attached, and the rooms it plays in.

When an exercise template left placeholders unfilled, it can propose values for them. Accepting that proposal, on the MSEL's page, opens the same dialog as **Fill them in…** with the proposed values: you review them there, and nothing is written until you confirm.

**Discard** asks first, and you can say why (already covered, not realistic for us, out of scope, wrong tone, incorrect) and add a note. Both are optional. The assistant reads them before it proposes again, so it doesn't repeat what you turned down.

It can propose resetting the MSEL's codes to its order after deletions leave gaps; accepting it runs the same reset as the button on the MSEL, while it's a draft.

On the MSEL it can also propose an inject's expected actions anew, where a contingent inject branches off and rejoins, the MSEL's own settings and its impact meters. A newer proposal on the same fields replaces an older one, so you don't review outdated versions.

In the session plan it can also propose the invitation's text, the briefing's and the session's notes and how the evaluation's data is collected. Dates, people and the venue stay with you.

It can build an MSEL from an empty one: it proposes the phases and actors first, then injects on them. Accepting an inject brings the phase and actors it needs with it, and discarding a phase discards the injects that need it.

## A new exercise and Library injects

It can propose a **new exercise**: a name, what it would test and its language. You find it in **Creator → New exercise**, under the assistant's panel; **Review** fills the form, and the exercise exists once you save it.

If you're an Exercise Program Manager it can propose **injects for your Library**, for instance one that worked in an exercise, rewritten so it fits any other. They wait in **Library → Injects → Organization**; **Review** opens the inject's form with the proposal, for you to complete (ATT&CK techniques are yours to add) and save.

Either can be discarded with a reason, like any other proposal.

## If you don't plan the exercise

What your client offers depends on your role, where your organization left the assistant on for it.

- **Exercise Program Manager**: the programme as a whole. Every exercise and how far it got, which capabilities you exercised and which never, overdue improvement actions and those closed without a later exercise testing them again. The *Plan the exercise programme* flow turns it into suggestions for the next exercises.
- **Controller or Facilitator**: before the session, the MSEL in running order with each inject's facilitator notes, the phases' key questions and the contingent injects. *Rehearse the session* walks you through it with the assistant answering as the table would; *Write the Facilitator's script* drafts how to open, moderate and close each phase.
- **Evaluator**: the EEGs you rate, with what to watch for at each observation point, and after the session your own notes put in order against them (*Prepare my evaluation*). It never suggests a rating: that's yours to give.

None of it is available while the session is in play. Observers and Players don't use the assistant.

## Ask from the page

You don't have to explain in your client what you're looking at. On the needs analysis, the MSEL and the session plan, **Ask the AI assistant** leaves a request: about the whole document or one of its rows, with a note saying what you need. Nothing happens yet. The next time you open your client, ask it to work through your requests (there's a guided flow for it): it reads them and answers with proposals, which come back to the page marked **Answers your request**. You can withdraw a request while it waits.

## Guided flows and attachments

Your client's menu offers guided flows that know which steps to take: design an exercise from a template, build the MSEL, review before READY, prepare the evaluation, draft the after-action report, lessons from past exercises, and work through your requests. Each asks for the exercise; type part of its code or name and pick it from the suggestions.

It can also name a set of proposals, such as "Close MSEL v5": the set shows together on the page, to accept or discard at once. Every answer about an exercise reminds it of the exercise's TLP. Accepting or discarding a proposal is recorded in the activity log, without its content.

Ask it what's left to finish a document: it answers with ordered steps, those it can propose and those only you can take, and where. The *Close a document* flow takes it as far as proposals can.

You can also attach an exercise's documents to the conversation (its needs analysis, MSEL, session plan or after-action report), or a knowledge base entry or exercise template, the same way you'd attach a file.

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

If your client connects to MCP servers over HTTP itself, the same page shows that configuration too, with no bridge to install:

   ```json
   {
     "mcpServers": {
       "ttx-zone": {
         "type": "http",
         "url": "https://ttx.example.org/api/v1/mcp",
         "headers": { "Authorization": "Bearer ttxz_..." }
       }
     }
   }
   ```

The file it goes in, and its exact shape, vary by client: check your client's documentation.

The Claude Desktop configuration needs Node.js on your machine. If your instance uses your organization's own certificate authority, point Node.js at it with `NODE_EXTRA_CA_CERTS` in the same `env` block.

## Tokens

You can have five active at a time, and revoke them from the same page. Changing your password or ending your sessions revokes them too.
