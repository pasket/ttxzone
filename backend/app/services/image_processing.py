import io

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings


class InvalidImageError(Exception):
    """Raised when `raw` isn't a real decodable image -- callers translate
    this into their own domain-specific AppException (avatar vs. org logo
    each have their own error code/message)."""


def process_square_image(raw: bytes) -> bytes:
    """Normalize an uploaded photo so stored files stay small and bounded
    no matter what the client sent: validates it's a real decodable image
    (not just a spoofed Content-Type header), corrects EXIF rotation,
    flattens transparency onto white, center-crops to a square, downsizes
    to AVATAR_MAX_DIMENSION_PX if larger, and re-encodes as JPEG at
    AVATAR_JPEG_QUALITY. Shared by avatar_service and
    organization_logo_service -- both want the exact same pipeline, just
    writing to different destinations.
    """
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise InvalidImageError from None

    image = ImageOps.exif_transpose(image)

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGBA")
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[-1])
        image = background
    else:
        image = image.convert("RGB")

    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))

    if side > settings.AVATAR_MAX_DIMENSION_PX:
        image = image.resize(
            (settings.AVATAR_MAX_DIMENSION_PX, settings.AVATAR_MAX_DIMENSION_PX),
            Image.LANCZOS,
        )

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=settings.AVATAR_JPEG_QUALITY)
    return buffer.getvalue()


# Decoded size a re-encode will accept: a small file may decompress into a
# huge bitmap (a decompression bomb).
_MAX_PIXELS = 50_000_000


def process_attachment_image(raw: bytes) -> tuple[bytes, str, int, int]:
    """Normalize an image attached to an inject: validates it's a real
    decodable image, corrects EXIF rotation, keeps its proportions,
    downsizes its longer side to MSEL_IMAGE_MAX_DIMENSION_PX if larger,
    and re-encodes it -- PNG stays PNG (screenshots keep sharp text),
    anything else becomes JPEG. Re-encoding drops every metadata block
    (EXIF, GPS...) and anything appended to the file. Returns the bytes,
    their content type, width and height."""
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.width * probe.height > _MAX_PIXELS:
                raise InvalidImageError
            probe.verify()
        image = Image.open(io.BytesIO(raw))
        source_format = image.format
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise InvalidImageError from None

    image = ImageOps.exif_transpose(image)
    limit = settings.MSEL_IMAGE_MAX_DIMENSION_PX
    if max(image.size) > limit:
        image.thumbnail((limit, limit), Image.LANCZOS)

    buffer = io.BytesIO()
    if source_format == "PNG":
        if image.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            image = image.convert("RGBA")
        image.save(buffer, format="PNG", optimize=True)
        content_type = "image/png"
    else:
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            image = image.convert("RGBA")
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        else:
            image = image.convert("RGB")
        image.save(buffer, format="JPEG", quality=85)
        content_type = "image/jpeg"
    return buffer.getvalue(), content_type, image.width, image.height
