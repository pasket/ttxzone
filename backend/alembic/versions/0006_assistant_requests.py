"""assistant requests

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-27 19:05:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: str | None = '0005'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'assistant_request',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('ttx_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('section', sa.String(length=16), nullable=False),
        sa.Column('row_id', sa.Uuid(), nullable=True),
        sa.Column('note', sa.String(length=1000), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('created_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=False),
        sa.Column('answered_at', sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.ForeignKeyConstraint(['ttx_id'], ['ttx.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_assistant_request_status'), 'assistant_request', ['status'], unique=False
    )
    op.create_index(
        op.f('ix_assistant_request_ttx_id'), 'assistant_request', ['ttx_id'], unique=False
    )
    op.create_index(
        op.f('ix_assistant_request_user_id'), 'assistant_request', ['user_id'], unique=False
    )
    op.add_column('assistant_proposal', sa.Column('request_id', sa.Uuid(), nullable=True))
    op.create_index(
        op.f('ix_assistant_proposal_request_id'), 'assistant_proposal', ['request_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_assistant_proposal_request_id'), table_name='assistant_proposal')
    op.drop_column('assistant_proposal', 'request_id')
    op.drop_index(op.f('ix_assistant_request_user_id'), table_name='assistant_request')
    op.drop_index(op.f('ix_assistant_request_ttx_id'), table_name='assistant_request')
    op.drop_index(op.f('ix_assistant_request_status'), table_name='assistant_request')
    op.drop_table('assistant_request')
