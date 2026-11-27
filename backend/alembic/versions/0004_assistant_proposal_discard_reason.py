"""assistant proposal discard reason

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-27 14:23:22.860887

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'assistant_proposal', sa.Column('decision_reason', sa.String(length=24), nullable=True)
    )
    op.add_column(
        'assistant_proposal', sa.Column('decision_note', sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('assistant_proposal', 'decision_note')
    op.drop_column('assistant_proposal', 'decision_reason')
