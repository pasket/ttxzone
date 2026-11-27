"""organization assistant roles

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-27 20:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0007'
down_revision: str | None = '0006'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing organizations keep what the instance switch gave them: the
    # assistant for Program Managers, Planners and the Lead Evaluator.
    op.add_column(
        'organization',
        sa.Column(
            'assistant_roles',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default='["program_manager", "planner", "evaluator"]',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('organization', 'assistant_roles')
