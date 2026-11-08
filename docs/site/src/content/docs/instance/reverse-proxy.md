---
title: Reverse proxy and TLS
description: What a proxy in front of TTX-Zone has to do.
sidebar:
  order: 6
---

`deploy/nginx/ttxzone.conf.template` already does everything on this page. Read it if you use another proxy or change the layout.

The proxy terminates TLS and is the only thing exposed. It forwards `/api/` and `/media/` to the API and everything else to the frontend.

## What it must do

- **HTTPS only**, with a redirect from HTTP and HSTS.
- **Leave `/api/v1/ttx` alone.** The API redirects `/api/v1/ttx/` to `/api/v1/ttx`, so nothing may redirect the other way. In Nginx, a `location /api/v1/ttx/` with `proxy_pass` does that unless `location = /api/v1/ttx` exists too, and the exercise list then never loads.
- **Allow large uploads.** Nginx's `client_max_body_size` defaults to 1 MB. Below the [application's limits](/instance/configuration/#limits-to-keep-in-step), an inject file or a scenario import fails with a generic error before reaching the API.
- **Don't buffer the session stream.** Live updates use Server-Sent Events on `/api/v1/ttx/*/run/stream`. Turn off proxy buffering there and allow long reads.
- **Send `frame-ancestors`** only if the proxy serves some other build of the frontend. The frontend image and the API already send it, with `X-Frame-Options: DENY`.

## The client's address

The proxy sends `X-Forwarded-For` and `X-Forwarded-Proto`. The API trusts them only from the addresses in `FORWARDED_ALLOW_IPS`, by default `127.0.0.1`, which means nobody in another container.

Set it to the proxy's address or network, comma-separated, CIDR allowed. Otherwise every session, sign-in event and access log line records the proxy's address, and everyone shares one count of failed sign-ins: 100 failures in 15 minutes then lock every sign-in.

:::danger
Never use `*` while the proxy appends to `X-Forwarded-For` (`$proxy_add_x_forwarded_for`). The API would believe the first address in the header, which the client writes. `*` is safe only if the outermost proxy replaces the header and nothing else can reach the API.
:::

## Certificates

The proxy of `deploy/` reads `certs/fullchain.pem` (the certificate followed by its intermediates) and `certs/privkey.pem` (its private key, unencrypted), for the name in `TTX_SERVER_NAME`. The Players' public face reads the same two files from `certs-public/`, for `TTX_PUBLIC_SERVER_NAME`. Nginx runs as uid 101 and must be able to read both:

```bash
sudo chown 101:101 certs/privkey.pem && sudo chmod 600 certs/privkey.pem
chmod 644 certs/fullchain.pem
```

With Docker Desktop (macOS, Windows), ownership doesn't carry into the container, and a key given to uid 101 can't be read there: keep the files yours and `chmod 644 certs/*.pem` instead, on a workstation only. Either way, the proxy checks both files before starting and says what to run when it can't read them.

After replacing them, reload the proxy without dropping anyone's session:

```bash
docker compose exec proxy nginx -s reload
```

Pick the source that fits where the instance lives.

### From your organization's CA

The usual case for an instance on the internal network. Create the key and a certificate request, and give the request to whoever runs the CA:

```bash
openssl req -new -newkey rsa:2048 -nodes \
  -subj "/CN=ttx.example.org" -addext "subjectAltName=DNS:ttx.example.org" \
  -keyout certs/privkey.pem -out ttx.csr
```

OpenSSL writes `privkey.pem` readable by you only: set its permissions as above once the certificate is in place. Put what comes back in `certs/fullchain.pem`: the certificate first, then each intermediate in order. Leave the root out, unless your CA says otherwise. People's devices must trust that CA, which managed devices in an organization usually do.

### From Let's Encrypt

Free, renewed every 60 to 90 days, trusted by every browser. It needs a public DNS name. Two ways to prove the name is yours:

**The HTTP challenge**, when port 80 of the server is reachable from the Internet. The proxy holds port 80, so `certbot` borrows it for a few seconds: the proxy is stopped while it checks, and the instance doesn't answer meanwhile.

```bash
sudo certbot certonly --standalone -d ttx.example.org \
  --pre-hook  "docker compose -f /opt/ttxzone/deploy/docker-compose.yml stop proxy" \
  --post-hook "docker compose -f /opt/ttxzone/deploy/docker-compose.yml start proxy"
```

**The DNS challenge**, for an instance the Internet can't reach, or to renew with no pause: `certbot` writes a TXT record through your DNS provider's plugin (`certbot-dns-cloudflare`, `certbot-dns-route53` and others), and nothing has to be reachable.

```bash
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/cloudflare.ini \
  -d ttx.example.org
```

Either way, `certbot` keeps the files in `/etc/letsencrypt/live/ttx.example.org/` as links, which the container can't follow. A deploy hook copies them into `certs/` with the right owner and reloads the proxy on each renewal. Save it as `/etc/letsencrypt/renewal-hooks/deploy/ttxzone.sh` and make it executable:

```bash
#!/bin/sh
set -e
src=/etc/letsencrypt/live/ttx.example.org
dst=/opt/ttxzone/deploy/certs
install -m 644 "$src/fullchain.pem" "$dst/fullchain.pem"
install -m 600 -o 101 -g 101 "$src/privkey.pem" "$dst/privkey.pem"
docker compose -f /opt/ttxzone/deploy/docker-compose.yml exec -T proxy nginx -s reload
```

Run it once by hand after the first `certonly`. `certbot` renews from its own timer (`systemctl list-timers | grep certbot`); `sudo certbot renew --dry-run` tries the whole cycle. Replace `/opt/ttxzone` with where `deploy/` lives, and `ttx.example.org` with your name; with the public face, repeat for its name into `certs-public/`, reloading `proxy-public`.

### Self-signed, to try it

For an instance on your own machine only: browsers warn about it, and nobody else should be asked to accept it.

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost" \
  -keyout certs/privkey.pem -out certs/fullchain.pem
chmod 644 certs/*.pem
```

Set `TTX_SERVER_NAME=localhost` to match. The `chmod` makes both files readable by the proxy, uid 101; on a Linux server, give the key to uid 101 instead, as above.

### Check it

```bash
openssl x509 -in certs/fullchain.pem -noout -subject -ext subjectAltName -enddate
curl -sI https://ttx.example.org | head -1
```

The name in `subjectAltName` must be `TTX_SERVER_NAME` exactly: browsers ignore the `CN`. If the proxy keeps restarting, `docker compose logs proxy` names the file it can't read.
