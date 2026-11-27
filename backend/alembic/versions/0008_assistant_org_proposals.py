"""assistant organization proposals

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-27 21:30:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0008'
down_revision: str | None = '0007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = 'assistant_org_proposal'
_INDEXED = ('organization_id', 'status', 'user_id')


def upgrade() -> None:
    op.create_table(
        _TABLE,
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('organization_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('target', sqlmodel.sql.sqltypes.AutoString(length=16), nullable=False),
        sa.Column('patch', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('summary', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(length=16), nullable=False),
        sa.Column('applied_id', sa.Uuid(), nullable=True),
        sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column('decided_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column('decision_reason', sqlmodel.sql.sqltypes.AutoString(length=24), nullable=True),
        sa.Column('decision_note', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organization.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    for column in _INDEXED:
        op.create_index(op.f(f'ix_{_TABLE}_{column}'), _TABLE, [column], unique=False)


def downgrade() -> None:
    for column in reversed(_INDEXED):
        op.drop_index(op.f(f'ix_{_TABLE}_{column}'), table_name=_TABLE)
    op.drop_table(_TABLE)
