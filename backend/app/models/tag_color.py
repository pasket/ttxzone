import re
from enum import StrEnum


class TagColor(StrEnum):
    """Palette shared by both tag pools (Organization and TTX). The 8
    original members plus TEAL/LIME/GRAPHITE are curated swatches chosen
    to stay clear of every color already carrying a fixed meaning
    elsewhere (--color-severity-*, --color-accent/-cta, -danger,
    -success) -- see frontend/src/index.css for their exact hex. CUSTOM
    is the escape hatch: a tag with color=CUSTOM carries its real color
    in the sibling `custom_hex` field instead (validated by
    CUSTOM_HEX_PATTERN below) rather than a fixed token, at the cost of
    no contrast guarantee -- the fixed swatches remain the safe default;
    CUSTOM is opt-in."""

    VIOLET = "violet"
    INDIGO = "indigo"
    FUCHSIA = "fuchsia"
    ROSE = "rose"
    PLUM = "plum"
    SLATE = "slate"
    SAND = "sand"
    MOSS = "moss"
    TEAL = "teal"
    LIME = "lime"
    GRAPHITE = "graphite"
    CUSTOM = "custom"


CUSTOM_HEX_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


def validate_custom_hex(color: TagColor, custom_hex: str | None) -> str | None:
    """Shared by both OrganizationTag*Request and TTXTag*Request schemas
    (via a pydantic model_validator) -- color=CUSTOM requires a valid
    "#RRGGBB" custom_hex; every other color must carry none, so a tag
    can never end up with a stale custom_hex left over from a prior edit
    that switched it back to a named swatch."""
    if color == TagColor.CUSTOM:
        if not custom_hex or not CUSTOM_HEX_PATTERN.match(custom_hex):
            raise ValueError('custom_hex must be a "#RRGGBB" hex color when color is "custom".')
        return custom_hex.lower()
    if custom_hex is not None:
        raise ValueError('custom_hex must be omitted unless color is "custom".')
    return None
