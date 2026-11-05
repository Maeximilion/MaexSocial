"""Narrow repository artwork policy; never use this as an upload sanitizer."""

from io import StringIO
from pathlib import Path
import re
import xml.etree.ElementTree as ET


MAX_BYTES = 256 * 1024
MAX_ELEMENTS = 2000
MAX_DEPTH = 32
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
ATTRIBUTES = {
    "svg": {"width", "height", "viewBox", "role", "aria-labelledby"},
    "title": {"id"},
    "desc": {"id"},
    "defs": set(),
    "g": {"clip-path", "font-family", "transform"},
    "rect": {"x", "y", "width", "height", "rx", "fill", "fill-opacity", "stroke", "stroke-opacity"},
    "circle": {"cx", "cy", "r", "fill"},
    "path": {"d", "fill", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin"},
    "text": {"x", "y", "fill", "fill-opacity", "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor"},
    "radialGradient": {"id"},
    "stop": {"offset", "stop-color", "stop-opacity"},
    "clipPath": {"id"},
}
DRAWING = {"g", "rect", "circle", "path", "text"}
CHILDREN = {
    "svg": DRAWING | {"defs", "title", "desc"},
    "g": DRAWING,
    "defs": {"radialGradient", "clipPath"},
    "radialGradient": {"stop"},
    "clipPath": {"rect", "circle", "path"},
}
IDENTIFIER = r"[A-Za-z_][A-Za-z0-9_.-]*"
LOCAL_URL = re.compile(r"url\(#(" + IDENTIFIER + r")\)")
COLOR = re.compile(r"(?:none|#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8})")
NUMBER = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)")
VALUE_PATTERNS = {
    "id": IDENTIFIER,
    "aria-labelledby": IDENTIFIER + r"(?: " + IDENTIFIER + r")*",
    "role": "img",
    "viewBox": r"[-+0-9.,\s]+",
    "d": r"[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+",
    "transform": r"(?:(?:translate|scale|rotate|matrix|skewX|skewY)\([-+0-9.,\s]+\)\s*)+",
    "font-family": r"[A-Za-z ,\-]+",
    "font-weight": r"[1-9]00",
    "text-anchor": r"(?:start|middle|end)",
    "stroke-linecap": r"(?:butt|round|square)",
    "stroke-linejoin": r"(?:miter|round|bevel)",
}


def check_svg(path: Path) -> list[str]:
    """Return policy violations without rendering or following external resources."""
    if path.suffix.lower() == ".svgz":
        return ["Compressed SVG artwork is unsupported"]
    if path.is_symlink():
        return ["SVG artwork must not be a symlink"]
    try:
        with path.open("rb") as source:
            data = source.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("SVG artwork exceeds 256 KiB")
        text = data.decode("utf-8")
        # Exclude declarations, entities, CDATA, comments and processing instructions.
        if "<!" in text or "<?" in text:
            raise ValueError("SVG XML declarations and processing instructions are unsupported")

        stack, references, identifiers = [], [], {}
        count = 0
        for event, element in ET.iterparse(StringIO(text), events=("start", "end", "start-ns")):
            if event == "start-ns":
                if element[1] != SVG_NAMESPACE:
                    raise ValueError("Only the SVG namespace is allowed")
                continue
            if event == "end":
                stack.pop()
                continue
            count += 1
            if count > MAX_ELEMENTS or len(stack) >= MAX_DEPTH:
                raise ValueError("SVG artwork exceeds element or nesting limits")
            namespace, _, tag = element.tag.rpartition("}")
            if namespace != "{" + SVG_NAMESPACE or tag not in ATTRIBUTES:
                raise ValueError("Unsupported SVG element or namespace")
            if (not stack and tag != "svg") or (stack and tag not in CHILDREN.get(stack[-1], set())):
                raise ValueError("Unsupported SVG element nesting")
            stack.append(tag)
            for attribute, value in element.attrib.items():
                if attribute not in ATTRIBUTES[tag]:
                    raise ValueError("Unsupported SVG attribute")
                if attribute in {"fill", "stroke", "clip-path", "stop-color"}:
                    reference = LOCAL_URL.fullmatch(value)
                    if reference and attribute != "stop-color":
                        target = "clipPath" if attribute == "clip-path" else "radialGradient"
                        references.append((reference[1], target))
                    elif attribute == "clip-path" or not COLOR.fullmatch(value):
                        raise ValueError("SVG paint and clipping require a color or supported local reference")
                elif attribute in VALUE_PATTERNS:
                    if not re.fullmatch(VALUE_PATTERNS[attribute], value):
                        raise ValueError("Unsupported SVG attribute value")
                elif not NUMBER.fullmatch(value) or abs(float(value)) > 1_000_000:
                    raise ValueError("SVG numeric attribute exceeds the artwork profile")
            if "id" in element.attrib:
                identifier = element.attrib["id"]
                if identifier in identifiers:
                    raise ValueError("SVG identifiers must be unique")
                identifiers[identifier] = tag
        if any(identifiers.get(identifier) != target for identifier, target in references):
            raise ValueError("SVG reference must name an existing supported gradient or clip path")
    except (OSError, UnicodeError, ET.ParseError, ValueError) as error:
        return [str(error)]
    return []
