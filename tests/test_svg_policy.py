"""The repository accepts only its small inert SVG artwork profile."""

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from scripts import check_repo


class SvgPolicyTests(unittest.TestCase):
    def check_content(self, content, name="probe.svg"):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / name).write_bytes(content.encode("utf-8") if isinstance(content, str) else content)
            with patch.object(check_repo.subprocess, "check_output", return_value=(name + "\0").encode()):
                return check_repo.check(root)

    def svg(self, content="", attributes=""):
        return f'<svg xmlns="http://www.w3.org/2000/svg" {attributes}>{content}</svg>'

    def test_repository_check_rejects_active_svg(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "probe.svg").write_text(
                '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
                encoding="utf-8",
            )
            with patch.object(check_repo.subprocess, "check_output", return_value=b"probe.svg\0"):
                self.assertTrue(check_repo.check(root), "Active SVG must fail repository CI")

    def test_existing_artwork_passes(self):
        assets = Path(__file__).resolve().parents[1] / ".github" / "assets"
        for path in sorted(assets.glob("*.svg")):
            with self.subTest(asset=path.name):
                self.assertEqual(self.check_content(path.read_bytes()), [])

    def test_active_elements_and_attributes_are_rejected(self):
        payloads = [
            '<script>alert(1)</script>',
            '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">HTML</div></foreignObject>',
            '<style>rect { fill: url(https://example.invalid/a); }</style>',
            '<animate attributeName="href" values="javascript:alert(1)"/>',
            '<a href="https://example.invalid"><text>link</text></a>',
            '<image href="data:image/svg+xml,active"/>',
            '<use href="#self" id="self"/>',
            '<rect onclick="alert(1)"/>',
            '<rect style="fill:red"/>',
            '<rect href="https://example.invalid/a"/>',
            '<rect xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="data:image/png,a"/>',
            '<rect xmlns:foreign="https://example.invalid" foreign:fill="#000"/>',
            '<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>',
            '<svg xmlns="http://www.w3.org/1999/xhtml"/>',
        ]
        for payload in payloads:
            with self.subTest(payload=payload):
                self.assertTrue(self.check_content(self.svg(payload)))

    def test_xml_declarations_and_invalid_encodings_are_rejected(self):
        payloads = [
            '<?xml-stylesheet href="https://example.invalid/a.css"?>' + self.svg(),
            '<!DOCTYPE svg [<!ENTITY x "entity">]>' + self.svg('<text>&x;</text>'),
            '<!DOCTYPE svg SYSTEM "file:///etc/passwd">' + self.svg(),
            self.svg().encode("utf-16"),
            b'\xff<svg/>',
            '<svg xmlns="http://www.w3.org/2000/svg">',
            '<html/>',
        ]
        for payload in payloads:
            with self.subTest(payload=repr(payload)[:100]):
                self.assertTrue(self.check_content(payload))

    def test_only_existing_local_gradient_and_clip_targets_pass(self):
        definitions = '<defs><radialGradient id="paint"><stop stop-color="#00E5FF"/></radialGradient><clipPath id="clip"><rect width="10" height="10"/></clipPath></defs>'
        valid = definitions + '<g clip-path="url(#clip)"><rect fill="url(#paint)"/></g>'
        self.assertEqual(self.check_content(self.svg(valid)), [])
        for attribute in [
            'fill="url(https://example.invalid/a)"',
            'fill="url(data:image/svg+xml,a)"',
            'fill="u\\72l(https://example.invalid/a)"',
            'fill="url(#missing)"',
            'fill="url(#clip)"',
            'fill="url(#paint) red"',
            'fill="url(&#104;ttps://example.invalid/a)"',
            'fill="javascript:alert(1)"',
        ]:
            with self.subTest(attribute=attribute):
                self.assertTrue(self.check_content(self.svg(definitions + f'<rect {attribute}/>')))
        self.assertTrue(self.check_content(self.svg(definitions + '<g clip-path="url(#paint)"/>')))
        self.assertTrue(self.check_content(self.svg('<defs><clipPath id="clip"><g clip-path="url(#clip)"/></clipPath></defs>')))
        self.assertTrue(self.check_content(self.svg('<title id="a"/><desc id="a"/>')))

    def test_size_complexity_and_compression_bounds(self):
        for payload in [
            self.svg(" " * (256 * 1024)),
            self.svg("<rect/>" * 2001),
            self.svg("<g>" * 33 + "</g>" * 33),
        ]:
            with self.subTest(length=len(payload)):
                self.assertTrue(self.check_content(payload))
        self.assertTrue(self.check_content(self.svg(), "probe.SvGz"))

    def test_extension_matching_is_case_insensitive(self):
        self.assertTrue(self.check_content(self.svg(attributes='onload="alert(1)"'), "probe.SVG"))

    def test_svg_symlink_is_rejected_before_opening(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / "probe.svg"
            path.write_text(self.svg(), encoding="utf-8")
            with patch.object(check_repo.subprocess, "check_output", return_value=b"probe.svg\0"), \
                 patch.object(Path, "is_symlink", return_value=True), \
                 patch.object(Path, "open", side_effect=AssertionError("Must not read symlink target")):
                self.assertTrue(check_repo.check(root))


if __name__ == "__main__":
    unittest.main()
