"""ConcurrencyLimitMiddleware: at most `limit` requests at once, the rest
waiting in the event loop; the Playground's streams never wait."""

import asyncio

from app.core.middleware import ConcurrencyLimitMiddleware


def _run(paths: list[str], limit: int) -> int:
    in_flight = 0
    peak = 0

    async def app(scope, receive, send):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.05)
        in_flight -= 1

    limited = ConcurrencyLimitMiddleware(app, limit=limit)

    async def main():
        await asyncio.gather(*(limited({"type": "http", "path": p}, None, None) for p in paths))

    asyncio.run(main())
    return peak


def test_requests_beyond_the_limit_wait() -> None:
    assert _run(["/api/v1/ttx/x/run"] * 10, limit=3) == 3


def test_streams_are_never_held_back() -> None:
    assert _run(["/api/v1/ttx/x/run/stream"] * 10, limit=3) == 10


def test_each_event_loop_gets_its_own_semaphore() -> None:
    """One middleware, two loops (another test client, a restart): the
    second must not hit a semaphore bound to the first."""
    in_flight = peak = 0

    async def app(scope, receive, send):
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.05)
        in_flight -= 1

    limited = ConcurrencyLimitMiddleware(app, limit=2)

    async def burst():
        await asyncio.gather(
            *(limited({"type": "http", "path": "/x"}, None, None) for _ in range(4))
        )

    asyncio.run(burst())
    asyncio.run(burst())
    assert peak == 2
