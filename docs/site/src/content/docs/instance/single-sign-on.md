---
title: Single sign-on
description: Let people sign in through an OpenID Connect provider.
sidebar:
  order: 9
---

People can sign in through one OpenID Connect provider for the whole instance, such as Microsoft Entra ID, Keycloak, Okta or Google Workspace. The sign-in page then shows a button for it, alongside the password.

## Before you start

`PUBLIC_BASE_URL` is required. The provider sends people back to this address, which you must register there exactly:

```
<PUBLIC_BASE_URL>/api/v1/auth/oidc/callback
```

**Instance administration → Single sign-on** shows it with a copy button.

## Microsoft Entra ID

1. Register an application in your tenant, as **single tenant**, on platform **Web**, with the redirect address above.
2. Create a client secret. Replace it before it expires.
3. Enter the tenant's GUID, the client ID and the secret. `common`, `organizations` and `consumers` are refused, so only your tenant's people can sign in.

## Another provider

Name it by its issuer URL over HTTPS, such as `https://idp/realms/<realm>` for Keycloak. Its metadata must be at `<issuer>/.well-known/openid-configuration`, and the `issuer` there must equal the URL you configured.

## Configure it

From **Instance administration → Single sign-on**, or in the environment, which pins it:

| Variable | Meaning |
|---|---|
| `OIDC_PROVIDER` | `entra` or `generic` |
| `OIDC_ENTRA_TENANT_ID` | The tenant, for `entra` |
| `OIDC_ISSUER_URL` | The issuer, for `generic` |
| `OIDC_CLIENT_ID` | The application's ID |
| `OIDC_CLIENT_SECRET` | The secret, or `OIDC_CLIENT_SECRET_FILE` |
| `OIDC_DISPLAY_NAME` | The name on the button |
| `OIDC_ALLOW_JIT` | Create accounts on first sign-in. Default `false` |
| `OIDC_TRUST_PROVIDER_MFA` | Accept the provider's second factor. Default `true` |

## Accounts

An account is matched on the provider's identifier for the person, never on the email after the first time. People with an existing account link it from **Preferences → Security**.

With `OIDC_ALLOW_JIT`, someone new gets an account on first sign-in, with no role and no password. A role still has to be granted in an organization.

## The provider's second factor

When the provider says it did multi-factor authentication, through the `amr` claim in the ID token, TTX-Zone accepts that for that session instead of its own second factor.

:::caution
This hasn't been tried against a real Microsoft Entra tenant, and Microsoft's documentation doesn't list `amr` in v2.0 ID tokens. It fails safe: without the claim, TTX-Zone still asks for its own second factor. Each sign-in event records `provider_mfa`, so you can read what your provider does.
:::
