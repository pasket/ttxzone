---
title: Tenancy and accounts
description: When to have several organizations, who may create them, and the instance's accounts, sign-in rules and legal documents.
sidebar:
  order: 7
---

The tenancy rule decides who may found organizations. A new instance is `managed` with at most one organization, so nobody can take it before you're ready.

## When to have several organizations

An organization is the unit of separation. Its people and their roles, its exercises, its library, its allowed domains and its improvement plan can't be seen from any other. One account can belong to several organizations, with different roles in each.

- **One organization** suits a company running its own exercise programme, which is most installations.
- **Several** suit groups that must not see each other's work: the subsidiaries of a group, or each client of a consultancy.
- **Outside participants don't need one.** Players, Observers and Evaluators from other entities join the leading organization's exercises.

## The rules

| Rule | Who founds organizations | Suits |
|---|---|---|
| `open` | Any account, optionally with a cap for the instance | A public service hosting unrelated teams |
| `single` | The first one to do it, then nobody | One company, installed by the person who will run it, unreachable by others until then |
| `managed` | Only an instance administrator, who names each one's first Exercise Program Manager | Every [installation](/instance/deployment-models/#choosing-an-installation) described in these guides: one company (maximum 1), a group (one per subsidiary), a consultancy (one per client) |

A stricter rule, or a cap below today's count, never deletes anything. It only stops new organizations.

## `single` or `managed` with a maximum of one

Once the organization exists they behave alike. They differ in how it's born.

| | `single` | `managed`, maximum 1 |
|---|---|---|
| Who founds it | The first account to choose **Set up my organization** | Only an instance administrator |
| Console access needed | No | Once, for the [first administrator](/instance/install/#create-the-first-administrator) |
| Risk | Whoever reaches the instance first owns the organization | None |
| Growing to several | Change the rule to `managed` | Raise the cap |

Use `single` only if nobody can reach the instance before you set it up.

## Setting it

From **Instance administration → Tenancy rule**, which applies at once. Or fix it in the environment, and the web shows it read-only:

```bash
TENANCY_MODE=managed
TENANCY_MAX_ORGANIZATIONS=5
```

## Free email domains

Under `open`, someone founding an organization needs a work email. Free email domains are refused, and so is a domain with no mail or address record. **Tenancy rule** shows the list while `open` is the saved rule: you can switch off a built-in domain or add your own.

## Sign-in security

**Instance administration → Sign-in security** sets the instance's password rules and which roles must use a second factor. By default the Exercise Program Manager, Exercise Planner, Evaluator and Observer roles must. The second factor by email never meets that requirement, because whoever controls the mailbox can already reset the password.

## Legal documents

**Instance administration → Legal documents** drafts your terms of service and privacy policy and publishes numbered versions. On a new instance both are empty: **Start from template** writes generic ones, in English and Spanish, with your details (operator, contact email, postal address, applicable law) into the drafts, to review with your legal adviser before publishing. While nothing is published, nobody is asked to accept anything. After a substantial change, people accept the new version the next time they sign in.

## Accounts

**Accounts** lists every account on the instance. From there you can create an account, reset a password to a temporary one, reset second factors when someone has lost them, end an account's sessions, suspend or reactivate it, and grant administrators.
