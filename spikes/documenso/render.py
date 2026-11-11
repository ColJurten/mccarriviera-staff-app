#!/usr/bin/env python3
"""Unsigned synthetic departure fixture; reference template is never modified."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import time
import sys

sys.dont_write_bytecode = True

import jinja2
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "docs/contract-template"
spec = importlib.util.spec_from_file_location("prototype", TEMPLATE / "build.py")
prototype = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prototype)

GEOMETRY = """() => Array.from(document.querySelectorAll('section.page'), (p, i) => {
  const page = p.getBoundingClientRect();
  const box = p.querySelector('.sigbox .img');
  if (!box || box.querySelector('img') || box.textContent.trim()) throw Error('Not unsigned');
  const r = box.getBoundingClientRect();
  return { page: i+1, positionX: 100*(r.x-page.x)/page.width,
    positionY: 100*(r.y-page.y)/page.height,
    width: 100*r.width/page.width, height: 100*r.height/page.height };
})"""


def render(lang, output):
    font_dir = os.environ.get("SPIKE_FONT_DIR")
    if font_dir:
        prototype.FONT_REG = str(Path(font_dir) / "Inter-Regular.otf")
        prototype.FONT_BOLD = str(Path(font_dir) / "Inter-SemiBold.otf")
    started = time.monotonic()
    output.mkdir(parents=True, exist_ok=True)
    # This fixture is explicitly documented as invented in the prototype.
    data = json.loads((TEMPLATE / "samples/specimen.json").read_text())
    data["_company"] = dict(name="SYNTHETIC RENTAL", address_line="1 rue du Test",
                            postcode_city="00000 Ville Exemple", siret="000 000 000 00000",
                            ape="0000Z", phones=["+33 1 99 00 00 00"],
                            web="example.test", email="office@example.test", vat_rate=20)
    data["contract"]["number"] = "SPIKE-2026-0001"
    data["renter"].update(first_name="Alex", last_name="EXEMPLE", email="spike@nomail.example.test")
    data["amendments"] = []
    # Generate photos only, never specimen signatures (even temporary ones).
    pics = {}
    photos = list(data["departure"]["reference_set"]["photos"])
    photos += [data["departure"]["dashboard_photo"], *data["departure"]["extra_photos"]]
    photos += [p for d in data["departure"]["open_damages"] for p in d["photos"]]
    for i, photo in enumerate(photos):
        file = output / f'{photo["id"]}.jpg'
        thumb = prototype.draw_photo(file, f"SYNTHETIC {i+1}", "reference", seed=i,
                                     angle=photo.get("angle", "front"))
        pics[photo["id"]] = {"full": file.name, "thumb": thumb.name}
    # Remove appended photo aliases from the reference list.
    data["departure"]["reference_set"]["photos"] = photos[:9]
    t = json.loads((TEMPLATE / f"i18n/{lang}.json").read_text())
    f = prototype.Fmt(t)
    pages, view = prototype.build_pages(data, "departure", t, f, pics)
    for page in pages:
        for key in ("sig_left", "sig_right"):
            page[key] = {**page[key], "image": None, "when": "", "text": ""}
    doc = dict(number=data["contract"]["number"], revision=1, specimen=True,
               stage_label=t["meta"]["stage_departure"],
               generated="SYNTHETIC UNSIGNED SPIKE · template v1 · EN terms pending" if lang == "en"
               else "SPÉCIMEN SYNTHÉTIQUE NON SIGNÉ · modèle v1 · FR v1")
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(TEMPLATE / "template"), autoescape=True)
    css = (TEMPLATE / "template/contract.css").read_text()
    if font_dir:
        for family, filename, weight in [("Inter", "Inter-Regular.otf", 400),
                                         ("Inter", "Inter-SemiBold.otf", 600),
                                         ("Lora", "Lora-Regular.ttf", 400)]:
            uri = (Path(font_dir) / filename).resolve().as_uri()
            css += f"\n@font-face {{font-family: '{family}'; src: url('{uri}'); font-weight: {weight};}}"
    html = env.get_template("contract.html.j2").render(t=t, co=data["_company"], doc=doc,
            pages=pages, v=view, css=css)
    target = output / f"departure-{lang}"
    target.with_suffix(".json").unlink(missing_ok=True)
    target.with_suffix(".html").write_text(html)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        page.goto(target.with_suffix(".html").as_uri())
        page.emulate_media(media="print")
        page.evaluate("document.fonts.ready")
        if page.evaluate(prototype.OVERFLOW_JS):
            raise RuntimeError(f"Prototype content overflows: {page.evaluate(prototype.OVERFLOW_JS)}")
        assert page.evaluate("""() => [...document.querySelectorAll('section.page')].every(p => {
          const r=p.getBoundingClientRect();
          return Math.abs(r.width-210*96/25.4)<0.1 && Math.abs(r.height-297*96/25.4)<0.1;
        })"""), "Not explicit A4 pages"
        assert page.evaluate("""() => [...document.images].every(i => i.complete && i.naturalWidth > 0)"""), "Missing fixture image"
        fields = page.evaluate(GEOMETRY)
        assert len(fields) == len(pages) and len(fields) > 1
        for field in fields:
            assert 0 < field["width"] and 0 < field["height"]
            assert 0 <= field["positionX"] < field["positionX"] + field["width"] <= 100
            assert 0 <= field["positionY"] < field["positionY"] + field["height"] <= 100
        page.pdf(path=str(target.with_suffix(".pdf")), prefer_css_page_size=True, print_background=True)
        browser.close()
    manifest = dict(language=lang, units="percent-top-left", pageCount=len(pages), fields=fields,
                    pdfSha256=hashlib.sha256(target.with_suffix(".pdf").read_bytes()).hexdigest())
    for field in fields:
        for key in ("positionX", "positionY", "width", "height"):
            assert abs(field[key] - fields[0][key]) < 0.02, "Per-page box parity failed"
    other = output / f'departure-{"en" if lang == "fr" else "fr"}.json'
    if other.exists():
        # English has one pending-terms page; compare the repeated box on every page.
        existing = json.loads(other.read_text())["fields"]
        for a in fields + existing:
            for key in ("positionX", "positionY", "width", "height"):
                assert abs(a[key] - fields[0][key]) < 0.02, "FR/EN box parity failed"
    target.with_suffix(".json").write_text(json.dumps(manifest, indent=2))
    print(f"{lang}: {len(pages)} unsigned pages, {time.monotonic()-started:.2f}s; manifest validated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", choices=["fr", "en"], required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent / "output")
    args = parser.parse_args()
    render(args.lang, args.output.resolve())
