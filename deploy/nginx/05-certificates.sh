#!/bin/sh
# Runs before nginx starts (the image runs /docker-entrypoint.d/*.sh and stops
# on a failure): both certificate files must be there and readable by this
# user, uid 101. Says what to run instead of OpenSSL's "Permission denied".
# Documentation site: Instance administration -> Reverse proxy and TLS.
for name in fullchain.pem privkey.pem; do
    file="/etc/nginx/certs/$name"
    if [ ! -e "$file" ]; then
        echo "TTX-Zone: $name is missing from the certificate folder (certs/, or certs-public/ for the public face)." >&2
        exit 1
    fi
    # Opened for real: on Docker Desktop the permission bits can say yes.
    if ! head -c 1 "$file" >/dev/null 2>&1; then
        echo "TTX-Zone: the proxy runs as uid $(id -u) and can't read $name. In the deploy folder:" >&2
        echo "  on a Linux server:                  sudo chown 101:101 certs/privkey.pem && sudo chmod 600 certs/privkey.pem && chmod 644 certs/fullchain.pem" >&2
        echo "  with Docker Desktop (macOS/Windows): chmod 644 certs/*.pem   (if the owner is 101 first: sudo chown \$(whoami) certs/*.pem)" >&2
        echo "  then: docker compose up -d" >&2
        exit 1
    fi
done
