# Repository settings (when it goes public)

Two protections can only be turned on once it is public (free for public repositories; on a private personal repository GitHub doesn't offer them), and they belong to the repository, not to the maintainer's account defaults:

- **Private vulnerability reporting**, which `SECURITY.md` points reporters to. The account default "auto-enable for new public repositories" covers repositories *created* public, not one turned public later, so check it explicitly.
- **Secret scanning with push protection** for the repository, so it covers every contributor's pushes (not only the maintainer's, which the account-level setting already protects) and alerts on the whole history.

Neither can be switched on while the repository is private (`PUT …/private-vulnerability-reporting` answers 404, the secret scanning `PATCH` 403).

## On the day

Run these right after changing the visibility. Changing repository settings needs a token with admin rights on the repository: a classic token with the `repo` scope, or a fine-grained token with **Administration: read and write** (the default `gh` token may not have it — `gh auth login` again with one that does). Or use the web UI: Settings → Advanced Security (Code security).

```bash
REPO=pasket/ttxzone

# 1. Visibility.
gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences

# 2. Private vulnerability reporting.
gh api -X PUT "repos/$REPO/private-vulnerability-reporting"

# 3. Secret scanning and push protection.
gh api -X PATCH "repos/$REPO" \
  -F 'security_and_analysis[secret_scanning][status]=enabled' \
  -F 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
```

4. **The container images.** GHCR packages created from a private repository stay private when it turns public, and `deploy/` pulls them without logging in. For each of `ttxzone-backend` and `ttxzone-frontend`: the package's page (github.com/users/pasket/packages/container/package/ttxzone-backend) → Package settings → Change visibility → Public. The API can't change a package's visibility.

5. **The documentation site** (`docs.ttxzone.com`, published by `.github/workflows/docs.yml` from a release tag). GitHub Pages isn't available to a private repository on a free plan, so this waits for the visibility change, and it must be done before the first release tag. The DNS side is already in place: `docs.ttxzone.com` is a `CNAME` to `pasket.github.io`, and `ttxzone.com` is a verified domain of the account (so no other account can claim it). No `CNAME` file is needed in the site: with Actions deployments the domain comes from the Pages settings.
   1. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
   2. Custom domain: `docs.ttxzone.com` → Save, and wait for the DNS check to pass.
   3. Settings → Environments → `github-pages` (created by step 1) → Deployment branches and tags → Add rule → **Tag**, pattern `v*.*.*`. By default the environment only accepts the default branch, and the workflow deploys from a tag: without this rule the publish job fails with "Tag v0.1.0 is not allowed to deploy to github-pages due to environment protection rules".
   4. After the release tag publishes the site and GitHub has issued the certificate (minutes to an hour): Settings → Pages → **Enforce HTTPS**.

## Check

```bash
gh api "repos/$REPO/private-vulnerability-reporting" --jq .enabled   # true
gh api "repos/$REPO" --jq .security_and_analysis                     # both "enabled"
gh api "repos/$REPO/secret-scanning/alerts" --jq 'length'            # 0 expected
docker logout ghcr.io; docker pull ghcr.io/pasket/ttxzone-backend:latest   # pulls without a login
curl -sI https://docs.ttxzone.com | head -1                          # HTTP/2 200, after the release tag
curl -sI http://docs.ttxzone.com | grep -i '^location'               # redirects to https, once enforced
```

Also open the repository's **Security** tab and confirm "Report a vulnerability" is offered. A secret scanning alert means a secret reached the history: rotate it first, then deal with the alert.
