"""Render the illustrative images of TTX-Zone's inject and scenario catalogs.

Each mock-up is an HTML page under app/data/injects/images/src/ or
app/data/scenarios/images/src/ (shared `base.css`, `i18n.js` filling in the
Spanish text from `data-es`), sized by its
`<meta name="size" content="WIDTHxHEIGHT">`. This renders every page in
English and Spanish with a headless Chrome into `<name>-<lang>.png`, one
folder above its source, then recompresses the PNG. A scenario carries its
image embedded: after rendering one, replace its entry in the file's `images`.

Runs on a workstation with Chrome, not in the backend container:

    python backend/scripts/render_inject_images.py [name ...]

`CHROME` overrides the browser's path."""

import os
import re
import shutil
import subprocess  # nosec B404 -- a fixed local browser, no shell, no user input
import sys
import tempfile
from pathlib import Path

from PIL import Image

DATA = Path(__file__).resolve().parents[1] / "app" / "data"
SOURCES = (DATA / "injects" / "images" / "src", DATA / "scenarios" / "images" / "src")
_SIZE = re.compile(r'<meta name="size" content="(\d+)x(\d+)">')
_MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def _chrome() -> str:
    found = os.environ.get("CHROME") or shutil.which("google-chrome") or shutil.which("chromium")
    if found:
        return found
    if Path(_MAC_CHROME).exists():
        return _MAC_CHROME
    sys.exit("No Chrome found: set CHROME to its path.")


def render(page: Path, chrome: str) -> None:
    size = _SIZE.search(page.read_text())
    if not size:
        sys.exit(f'{page.name}: missing <meta name="size" content="WxH">')
    width, height = size.groups()
    for lang in ("en", "es"):
        target = page.parent.parent / f"{page.stem}-{lang}.png"
        with tempfile.TemporaryDirectory() as profile:
            subprocess.run(  # nosec B603 -- fixed arguments, no shell
                [
                    chrome,
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--allow-file-access-from-files",
                    f"--user-data-dir={profile}",
                    f"--window-size={width},{height}",
                    f"--screenshot={target}",
                    f"{page.as_uri()}?lang={lang}",
                ],
                check=True,
                capture_output=True,
            )
        with Image.open(target) as image:
            image.load()
            optimized = image.convert("RGB")
        optimized.save(target, optimize=True)
        print(f"{target.name}: {target.stat().st_size // 1024} KB")


def main(names: list[str]) -> None:
    chrome = _chrome()
    pages = sorted(page for source in SOURCES for page in source.glob("*.html"))
    if names:
        pages = [p for p in pages if p.stem in names]
    for page in pages:
        render(page, chrome)


if __name__ == "__main__":
    main(sys.argv[1:])
