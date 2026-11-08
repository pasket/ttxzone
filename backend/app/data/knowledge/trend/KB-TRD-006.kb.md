---
format: "ttx-zone.knowledge"
format_version: 1
id: "KB-TRD-006"
kind: "trend"
title: "Payment fraud goes synthetic: business email compromise, cloned voices and deepfake video calls"
summary: "Business email compromise remains one of the most profitable crimes: hijacked or look-alike mailboxes, fake supplier bank changes and executive impersonation, now reinforced with AI-written lures, cloned voices and live deepfake video calls."
language: "en"
sectors: ["cross-sector", "finance"]
families: ["bec_fraud", "phishing_account_takeover"]
capabilities: ["detection_triage_escalation", "crisis_decision_making", "legal_forensics"]
attack_version: "19.2"
attack_techniques: ["enterprise:T1566.002", "enterprise:T1586.002", "enterprise:T1114.003", "enterprise:T1564.008", "enterprise:T1534", "enterprise:T1684.001", "enterprise:T1683.002", "enterprise:T1566.004", "enterprise:T1657"]
attack_groups: []
related: ["KB-TRD-002", "KB-TRD-009", "KB-CAS-006"]
source_class: "annual-industry-report"
period: "2024-2025"
reviewed: "2026-10-31"
---
# Payment fraud goes synthetic: business email compromise, cloned voices and deepfake video calls

## Overview
Business email compromise (BEC) needs no malware and no encryption: it convinces someone with payment authority to send money to the wrong account. The classic pretexts are still the most common: a supplier "changing bank details" for the next invoices, an executive asking for an urgent and confidential transfer, a lawyer handling a "secret acquisition". The attacker either takes over a real mailbox (of the organization or, more often, of a supplier) and reads the conversation for weeks, or registers a look-alike domain. Generative AI has removed the spelling mistakes and lets the same group write fluent lures in any language, clone an executive's voice from public recordings, and run a video call in which every other participant is synthetic. Defenses that relied on "it sounded like the boss" or "I saw her on camera" no longer hold.

## Indicative figures
- BEC accounts for billions in reported losses per year; the median loss per complaint has stabilized around fifty thousand, while single deepfake-assisted cases have reached tens of millions.
- Around 9 in 10 fraudulent payouts go by bank wire, not cryptocurrency or gift cards.
- In some incident-response datasets BEC is the most frequent engagement type, ahead of ransomware.
- Cyber-enabled fraud ranks among the top concerns of executive leadership (roughly 20 to 30 % name it a top risk).
- AI-generated text appears in a large majority (over 80 %) of observed phishing; AI-tailored spear-phishing gets click rates several times higher than generic campaigns.
- Funds recovered after the fact are a small fraction; recovery chances drop sharply after the first 24 to 48 hours.

## Typical attack chain
1. **Mailbox access**: credential phishing or a session hijack against an employee or, more often, a supplier's mailbox (T1566.002, T1586.002).
2. **Silent observation**: forwarding and hiding rules keep copies of invoice threads and suppress replies the attacker doesn't want seen (T1114.003, T1564.008).
3. **Pretext**: at the right moment, the attacker replies within a real thread, or from a look-alike domain, with "new bank details" or an urgent request from an executive (T1534, T1684.001).
4. **Reinforcement**: a follow-up call with a cloned voice, or a short video call with a deepfake executive and "colleagues", removes the doubt (T1683.002, T1566.004).
5. **Payment**: the transfer goes to a mule account and is moved on within hours (T1657).
6. **Repeat**: if undetected, a second and third payment are requested, often for larger amounts.

## Realistic timings
- Weeks of silent mailbox access before the fraudulent request is common; the request itself lands just before a payment run or a holiday.
- From the fraudulent email to the transfer: hours to a few days, compressed by "urgent" and "confidential" framing.
- Funds leave the first mule account within hours; the bank recall window is roughly the first day.
- Discovery typically happens when the real supplier chases an unpaid invoice, often two to six weeks later.

## Exercise hooks
- A supplier's "bank change" letter arrives in a real thread; accounts payable has already paid one invoice to the new account.
- The CFO joins a short video call with the "CEO" and two "board members" asking for a confidential transfer; afterwards the CEO is unreachable.
- Ask who calls the bank to recall the payment, how fast, and whether the incident is also a data breach (the attacker read the mailbox).
- Test the call-back procedure: is it to a number from the email, or to one already on file?
- Bring in the supplier: whose mailbox was compromised, who notifies whom, and who bears the loss?
