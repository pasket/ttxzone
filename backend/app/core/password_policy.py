import re
from typing import Annotated

from pydantic import AfterValidator, Field

PASSWORD_MIN_LENGTH = 8
# Bounds of the deployment's own rules on top of this floor (Platform ->
# Security, services/security_policy_service.py).
PASSWORD_MIN_LENGTH_MAX = 64
PASSWORD_HISTORY_MAX = 24
PASSWORD_MAX_AGE_DAYS_MAX = 730


def validate_password_strength(password: str) -> str:
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least one lowercase letter.")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must include at least one number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include at least one symbol.")
    return password


StrongPassword = Annotated[
    str,
    Field(min_length=PASSWORD_MIN_LENGTH, max_length=128),
    AfterValidator(validate_password_strength),
]
