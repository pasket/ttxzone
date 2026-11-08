"""Adds N Players (load-NNNN@acme.com, the demo password) to the demo
exercise of the database the backend points at, for scripts.load_test.players.
Prints the exercise id. Never against a real database: run it on a
throwaway one seeded with scripts.seed_demo, e.g.

    docker compose exec -e POSTGRES_DB=ttx_zone_load backend \
      python -m scripts.load_test.seed_players 300"""

import sys

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import hash_password
from app.models import TTX, RoleEnum, TTXAccess, User

PASSWORD = "DemoTTX-2026!"  # nosec B105 -- the demo accounts' public password
n = int(sys.argv[1])
hashed = hash_password(PASSWORD)
with Session(engine) as s:
    ttx = s.exec(select(TTX)).one()
    have = {u.email for u in s.exec(select(User).where(User.email.like("load-%")))}
    for i in range(n):
        email = f"load-{i:04d}@acme.com"
        if email in have:
            continue
        u = User(email=email, hashed_password=hashed, full_name=f"Load Player {i:04d}")
        s.add(u)
        s.flush()
        s.add(TTXAccess(user_id=u.id, ttx_id=ttx.id, role=RoleEnum.PLAYER))
    s.commit()
    print(ttx.id)
