"""organization design context

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-27 18:10:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: str | None = '0004'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS = (
    ('sector', 255),
    ('size', 255),
    ('regulators', 1000),
    ('technologies', 2000),
    ('critical_assets', 2000),
)


def upgrade() -> None:
    for name, length in _COLUMNS:
        op.add_column('organization', sa.Column(name, sa.String(length=length), nullable=True))


def downgrade() -> None:
    for name, _length in reversed(_COLUMNS):
        op.drop_column('organization', name)
