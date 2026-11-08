import uuid

from sqlmodel import Field, SQLModel


class TTXExerciseRisk(SQLModel, table=True):
    """A risk to the exercise itself (section 8) and how it is handled."""

    __tablename__ = "ttx_exercise_risk"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    form_id: uuid.UUID = Field(foreign_key="ttx_needs_form.id", index=True)
    position: int = Field(default=0)
    risk: str = Field(default="")
    mitigation: str = Field(default="")
    owner: str = Field(default="", max_length=255)
