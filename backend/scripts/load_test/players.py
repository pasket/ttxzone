"""Load test of the Players' face (docs/deployment.md, section 10).

N Players (load-NNNN@acme.com, from seed_players) sign in, open the stream
and fetch their view after every ring -- as frontend/src/hooks/useRunFeed.ts
does: SSE, GET /run?since= with the background header, a safety fetch every
30 s -- while the demo's Controller, on the internal face, releases an
inject every R seconds. Reports GET /run latency while they join and once
they're in, how long a released inject takes to reach every Player's view,
and errors, as JSON.

Development only (httpx is a dev dependency, and the production image leaves
this folder out). Run it from the development image (`docker compose images
backend` names it) on the deployment's network, e.g.:

    docker run --rm --network <project>_ttx -v "$PWD/backend:/app:ro" \
      <dev image> python -m scripts.load_test.players --ttx <id> \
      --public http://<public api>:8000 --internal http://<internal api>:8000 \
      --players 300 --code <the Controller's current TOTP code>"""

import argparse
import asyncio
import json
import random
import statistics
import time

import httpx

PASSWORD = "DemoTTX-2026!"  # nosec B105 -- the demo accounts' public password
p = argparse.ArgumentParser()
p.add_argument("--public", required=True, help="the public face's API base URL")
p.add_argument("--internal", required=True, help="the internal face's API base URL")
p.add_argument("--ttx", required=True)
p.add_argument("--players", type=int, default=100)
p.add_argument("--ramp", type=float, default=30.0)
p.add_argument("--steady", type=float, default=90.0)
p.add_argument("--release-every", type=float, default=15.0)
p.add_argument("--code", required=True, help="the Controller's current TOTP code")
p.add_argument("--out", default="load-test-result.json")
args = p.parse_args()

API = "/api/v1"
gets = []  # (t, phase, seconds, status, bytes)
errors = {}  # what -> count
seen_at = {}  # inject code -> list of seconds after release
released_at = {}  # inject code -> t
phase = "join"
stop = asyncio.Event()


def err(what):
    errors[what] = errors.get(what, 0) + 1


def pct(values, q):
    if not values:
        return None
    values = sorted(values)
    return round(values[min(len(values) - 1, int(q * len(values)))] * 1000, 1)


async def login(client, email, code=None):
    r = await client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    if r.status_code != 200:
        err(f"login {r.status_code}")
        return False
    body = r.json()
    if body.get("mfa_required"):
        r = await client.post(
            f"{API}/auth/login/verify-totp",
            json={"mfa_pending_token": body["mfa_pending_token"], "code": code},
        )
        return r.status_code == 200
    return True


async def player(i, ready):
    await asyncio.sleep(random.uniform(0, args.ramp))  # nosec B311 -- spreads sign-ins
    limits = httpx.Limits(max_connections=4)
    async with httpx.AsyncClient(base_url=args.public, timeout=60, limits=limits) as c:
        if not await login(c, f"load-{i:04d}@acme.com"):
            return
        ready.append(i)
        cursor = None
        have = set()
        headers = {"X-Background-Request": "1"}

        async def fetch():
            nonlocal cursor
            params = {"as": "player"}
            if cursor:
                params["since"] = cursor
            t0 = time.monotonic()
            try:
                r = await c.get(f"{API}/ttx/{args.ttx}/run", params=params, headers=headers)
            except httpx.HTTPError as e:
                err(f"get {type(e).__name__}")
                return
            dt = time.monotonic() - t0
            gets.append((t0, phase, dt, r.status_code, len(r.content)))
            if r.status_code == 200:
                body = r.json()
                cursor = body.get("cursor")
                now = time.monotonic()
                for inj in body.get("injects", []):
                    code = inj["code"]
                    if code not in have:
                        have.add(code)
                        if code in released_at:
                            seen_at.setdefault(code, []).append(now - released_at[code])
            elif r.status_code != 204:
                err(f"get {r.status_code}")

        last = 0.0
        while not stop.is_set():
            try:
                async with c.stream(
                    "GET",
                    f"{API}/ttx/{args.ttx}/run/stream",
                    params={"as": "player"},
                    timeout=httpx.Timeout(60, read=40),
                ) as s:
                    if s.status_code != 200:
                        err(f"stream {s.status_code}")
                        await asyncio.sleep(3)
                        continue
                    async for line in s.aiter_lines():
                        if stop.is_set():
                            break
                        if line.startswith("event: change"):
                            await fetch()
                            last = time.monotonic()
                        elif time.monotonic() - last > 30:
                            await fetch()
                            last = time.monotonic()
            except (TimeoutError, httpx.HTTPError) as e:
                err(f"stream {type(e).__name__}")
                await asyncio.sleep(1)


async def controller():
    async with httpx.AsyncClient(base_url=args.internal, timeout=60) as c:
        if not await login(c, "controller@demo.example.com", args.code):
            raise SystemExit("The Controller couldn't sign in: pass a fresh --code.")

        def csrf():
            return {"X-CSRF-Token": c.cookies.get("ttx_csrf_token")}

        r = await c.get(f"{API}/ttx/{args.ttx}/run", params={"as": "controller"})
        if r.status_code != 200 or r.json().get("status") != "live":
            r = await c.post(f"{API}/ttx/{args.ttx}/run/start", headers=csrf())
            if r.status_code != 200:
                raise SystemExit(f"The session didn't start: {r.text}")
        await asyncio.sleep(args.ramp + 5)
        global phase
        phase = "steady"
        end = time.monotonic() + args.steady
        while time.monotonic() < end:
            view = (await c.get(f"{API}/ttx/{args.ttx}/run", params={"as": "controller"})).json()
            pending = [
                i
                for i in view["control"]["injects"]
                if i["kind"] == "mandatory"
                and i.get("state") in ("upcoming", "due", "pending", "scheduled")
                and i["code"] not in released_at
            ]
            if not pending:
                break
            code = pending[0]["code"]
            released_at[code] = time.monotonic()
            r = await c.post(f"{API}/ttx/{args.ttx}/run/injects/{code}/release", headers=csrf())
            if r.status_code != 200:
                err(f"release {r.status_code}")
                released_at.pop(code, None)
            await asyncio.sleep(args.release_every)
        await asyncio.sleep(5)
        stop.set()


async def main():
    ready = []
    t_start = time.monotonic()
    tasks = [asyncio.create_task(player(i, ready)) for i in range(args.players)]
    await controller()
    await asyncio.sleep(2)
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    result = {
        "players": args.players,
        "signed_in": len(ready),
        "errors": errors,
        "duration_s": round(time.monotonic() - t_start, 1),
    }
    for ph in ("join", "steady"):
        rows = [g for g in gets if g[1] == ph]
        lat = [g[2] for g in rows]
        span = (max(g[0] for g in rows) - min(g[0] for g in rows)) if len(rows) > 1 else 1
        result[ph] = {
            "gets": len(rows),
            "per_s": round(len(rows) / max(span, 1), 1),
            "status_200": sum(1 for g in rows if g[3] == 200),
            "status_204": sum(1 for g in rows if g[3] == 204),
            "p50_ms": pct(lat, 0.5),
            "p95_ms": pct(lat, 0.95),
            "p99_ms": pct(lat, 0.99),
            "max_ms": pct(lat, 1),
            "avg_kb": round(statistics.mean([g[4] for g in rows if g[3] == 200] or [0]) / 1024, 1),
        }
    deliveries = {code: v for code, v in seen_at.items()}
    all_d = [x for v in deliveries.values() for x in v]
    result["delivery"] = {
        "injects": len(released_at),
        "reached_all": sum(1 for c in released_at if len(seen_at.get(c, [])) >= len(ready)),
        "p50_ms": pct(all_d, 0.5),
        "p95_ms": pct(all_d, 0.95),
        "max_ms": pct(all_d, 1),
    }
    json.dump(result, open(args.out, "w"), indent=2)
    print(json.dumps(result, indent=2))


asyncio.run(main())
