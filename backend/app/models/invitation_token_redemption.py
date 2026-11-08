import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class InvitationTokenRedemption(SQLModel, table=True):
    """Audit row for one user's redemption of an InvitationToken. Prevents
    the same user redeeming the same token twice, while allowing distinct
    users to redeem it up to the token's max_uses.
    """

    __tablename__ = "invitation_token_redemption"
    __table_args__ = (UniqueConstraint("invitation_token_id", "user_id"),)

    id: int | None = Field(default=None, primary_key=True)
    invitation_token_id: uuid.UUID = Field(foreign_key="invitation_token.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    redeemed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
