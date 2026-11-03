#!/usr/bin/env python3
"""Render the contract template specimens (reference design for US-040).

Usage (from the repository root):
    python3 docs/contract-template/build.py

Needs Python 3 with jinja2, markdown, Pillow and Playwright (Chromium), and the Inter and Lora fonts.
It draws placeholder photos and signatures, fills template/contract.html.j2 with the synthetic data in
samples/specimen.json, and prints four PDFs to samples/:

    specimen-final-fr.pdf    Départ, one amendment and Retour, in French
    specimen-final-en.pdf    the same in English (terms page: approved English text pending, R-17)
    specimen-depart-fr.pdf   the PDF shared right after the Départ is signed
    modele-vierge-fr.pdf     every page with empty fields, for the client's review

The API renders the same pages with Chromium (ADR-0010), and Documenso places the signatures (ADR-0020); this script only shows what they look like.
Never put real client data in samples/specimen.json.
"""
import copy
import datetime as dt
import json
import math
import pathlib
import random
import re
import sys
import tempfile

import jinja2
import markdown
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
SAMPLES = HERE / "samples"
FONT_BOLD = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FONT_REG = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
ANGLES = ["front", "front_left", "left", "rear_left", "rear", "rear_right", "right", "front_right", "interior"]


# ---------------------------------------------------------------- formatting (ADR-0011)

class Fmt:
    def __init__(self, t):
        self.t = t
        self.f = t["fmt"]
        self.lang = t["lang"]

    def _parse(self, s):
        return dt.datetime.fromisoformat(s) if "T" in s else dt.datetime.fromisoformat(s + "T00:00")

    def date(self, s):
        if not s:
            return ""
        d = self._parse(s)
        day = "1er" if (self.lang == "fr" and d.day == 1) else str(d.day)
        return self.f["date"].format(d=day, month=self.f["months"][d.month - 1], y=d.year)

    def time(self, s):
        return self._parse(s).strftime("%H:%M") if s else ""

    def datetime(self, s):
        return self.f["datetime"].format(date=self.date(s), time=self.time(s)) if s else ""

    def number(self, n, decimals=0):
        if n is None or n == "":
            return ""
        txt = f"{n:,.{decimals}f}"
        return txt.replace(",", "\u0001").replace(".", self.f["decimal"]).replace("\u0001", self.f["thousands"])

    def money(self, n):
        return self.f["money"].format(n=self.number(n, 2)) if n not in (None, "") else ""

    def km(self, n):
        return self.f["km"].format(n=self.number(n)) if n not in (None, "") else ""

    def per_km(self, n):
        return self.f["per_km"].format(n=self.number(n, 2)) if n not in (None, "") else ""

    def per_day(self, n):
        return self.f["per_day"].format(n=self.number(n, 2)) if n not in (None, "") else ""

    def fuel(self, eighths):
        if eighths is None:
            return ""
        pct = round(eighths * 12.5)
        return f"{eighths}/8 · {pct} %" if self.lang == "fr" else f"{eighths}/8 · {pct}%"


def fill(template, **kw):
    for k, val in kw.items():
        template = template.replace("{" + k + "}", str(val))
    return template


# ---------------------------------------------------------------- placeholder images (no real photos)

def _font(path, size):
    return ImageFont.truetype(path, size)


def _band(draw, w, h, text):
    draw.rectangle([0, h - 92, w, h], fill=(20, 20, 20))
    draw.text((40, h - 70), text, font=_font(FONT_BOLD, 40), fill=(194, 155, 69))


def _scene(w, h, rnd):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        k = y / h
        if k < 0.58:
            c = (int(196 + 30 * k), int(206 + 20 * k), int(214 + 14 * k))
        else:
            g = int(118 - 40 * (k - 0.58))
            c = (g, g, g + 4)
        d.line([(0, y), (w, y)], fill=c)
    for _ in range(14):
        x = rnd.randint(0, w)
        d.line([(x, int(h * 0.82)), (x + 140, int(h * 0.82))], fill=(205, 205, 196), width=6)
    return img, d


def _wheel(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(28, 28, 30))
    d.ellipse([cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62], fill=(170, 172, 176))
    for a in range(0, 360, 72):
        x = cx + r * 0.55 * math.cos(math.radians(a))
        y = cy + r * 0.55 * math.sin(math.radians(a))
        d.line([(cx, cy), (x, y)], fill=(110, 112, 116), width=10)


def _car_side(d, x0, y0, length, flip=False, body=(24, 24, 26)):
    """Stylised side profile; flip mirrors it (left / right side)."""
    def X(x):
        return x0 + (length - x if flip else x)
    h = length * 0.26
    base = [(0, h * 0.62), (length * 0.04, h * 0.30), (length * 0.30, h * 0.22), (length * 0.42, 0),
            (length * 0.70, 0), (length * 0.86, h * 0.26), (length, h * 0.36), (length, h * 0.68),
            (length * 0.95, h * 0.82), (length * 0.05, h * 0.82)]
    d.polygon([(X(x), y0 + y) for x, y in base], fill=body)
    win = [(length * 0.33, h * 0.24), (length * 0.44, h * 0.05), (length * 0.68, h * 0.05), (length * 0.80, h * 0.26)]
    d.polygon([(X(x), y0 + y) for x, y in win], fill=(150, 170, 186))
    d.line([(X(length * 0.56), y0 + h * 0.05), (X(length * 0.56), y0 + h * 0.26)], fill=body, width=10)
    for fx in (0.2, 0.8):
        _wheel(d, X(length * fx), y0 + h * 0.82, length * 0.085)


def _car_face(d, cx, y0, width, rear=False, body=(24, 24, 26)):
    h = width * 0.56
    d.rounded_rectangle([cx - width / 2, y0 + h * 0.35, cx + width / 2, y0 + h * 0.86], radius=40, fill=body)
    d.polygon([(cx - width * 0.36, y0 + h * 0.38), (cx - width * 0.26, y0 + h * 0.02),
               (cx + width * 0.26, y0 + h * 0.02), (cx + width * 0.36, y0 + h * 0.38)], fill=body)
    d.polygon([(cx - width * 0.31, y0 + h * 0.36), (cx - width * 0.23, y0 + h * 0.08),
               (cx + width * 0.23, y0 + h * 0.08), (cx + width * 0.31, y0 + h * 0.36)], fill=(150, 170, 186))
    lamp = (200, 40, 40) if rear else (236, 236, 226)
    for sx in (-1, 1):
        d.ellipse([cx + sx * width * 0.36 - 34, y0 + h * 0.5 - 18, cx + sx * width * 0.36 + 34, y0 + h * 0.5 + 18], fill=lamp)
        d.rectangle([cx + sx * width * 0.40 - 28, y0 + h * 0.86, cx + sx * width * 0.40 + 28, y0 + h * 0.98], fill=(28, 28, 30))
    d.rectangle([cx - width * 0.13, y0 + h * 0.62, cx + width * 0.13, y0 + h * 0.72], fill=(232, 232, 220))
    d.text((cx - width * 0.11, y0 + h * 0.625), "AA-123-AA", font=_font(FONT_BOLD, 30), fill=(20, 20, 20))


def draw_photo(path, label, kind, angle=None, seed=0, km=None, fuel=None):
    rnd = random.Random(seed)
    w, h = 1600, 1200
    if kind == "dashboard":
        img = Image.new("RGB", (w, h), (34, 34, 38))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([140, 220, w - 140, 860], radius=120, fill=(18, 18, 20))
        for cx in (560, 1040):
            d.ellipse([cx - 210, 330, cx + 210, 750], outline=(194, 155, 69), width=10)
        d.text((430, 520), f"{km:,} km".replace(",", " "), font=_font(FONT_BOLD, 64), fill=(240, 240, 232))
        ang = math.radians(210 - (fuel or 0) / 8 * 240)
        d.line([(1040, 540), (1040 + 170 * math.cos(ang), 540 - 170 * math.sin(ang))], fill=(220, 60, 50), width=12)
        d.text((990, 640), "E      F", font=_font(FONT_BOLD, 40), fill=(240, 240, 232))
    elif kind == "damage":
        img = Image.new("RGB", (w, h), (36, 36, 40))
        d = ImageDraw.Draw(img)
        for _ in range(9000):
            x, y = rnd.randint(0, w), rnd.randint(0, h)
            g = rnd.randint(30, 52)
            d.point((x, y), fill=(g, g, g + 4))
        d.ellipse([w * 0.2, h * 0.08, w * 0.8, h * 0.3], fill=(70, 74, 82))
        if "glass" in label:
            cx, cy = w // 2, h // 2
            for a in range(0, 360, 40):
                r = rnd.randint(140, 260)
                d.line([(cx, cy), (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))], fill=(230, 232, 236), width=4)
            d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=(240, 240, 244), width=6)
        else:
            pts = [(w * 0.3, h * 0.55)]
            for _ in range(10):
                x, y = pts[-1]
                pts.append((x + rnd.randint(40, 70), y + rnd.randint(-14, 10)))
            d.line(pts, fill=(222, 222, 216), width=7)
        d.rectangle([w * 0.06, h * 0.08, w * 0.06 + 240, h * 0.08 + 18], fill=(194, 155, 69))
    elif kind == "extra":
        img, d = _scene(w, h, rnd)
        _wheel(d, w // 2, h // 2, 330)
        d.arc([w // 2 - 300, h // 2 - 300, w // 2 + 300, h // 2 + 300], start=300, end=340, fill=(230, 230, 222), width=12)
    elif angle == "interior":
        img = Image.new("RGB", (w, h), (52, 46, 40))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, 360], fill=(150, 170, 186))
        d.rounded_rectangle([0, 330, w, 560], radius=60, fill=(30, 28, 26))
        d.ellipse([360, 420, 760, 820], outline=(18, 18, 18), width=44)
        for x in (240, 980):
            d.rounded_rectangle([x, 700, x + 380, h - 120], radius=60, fill=(120, 72, 44))
    else:
        img, d = _scene(w, h, rnd)
        if angle in ("left", "right"):
            _car_side(d, 140, 330, 1320, flip=(angle == "right"))
        elif angle in ("front", "rear"):
            _car_face(d, w // 2, 300, 1000, rear=(angle == "rear"))
        else:
            flip = angle in ("front_right", "rear_left")
            _car_side(d, 200, 340, 1200, flip=flip)
    _band(d, w, h, "PHOTO FICTIVE · SAMPLE PHOTO")
    img.save(path, "JPEG", quality=78, optimize=True)
    thumb = path.with_name(path.stem + "_t.jpg")
    img.resize((480, 360), Image.LANCZOS).save(thumb, "JPEG", quality=72, optimize=True)
    return thumb


def draw_signature(path, seed):
    rnd = random.Random(seed)
    scale = 3
    w, h = 900 * scale, 320 * scale
    img = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    pts = []
    x, y = 60 * scale, 200 * scale
    for i in range(240):
        t = i / 239
        x = (60 + 760 * t) * scale
        y = (170 + 70 * math.sin(t * 12 + seed) * (1 - t * 0.5) + 30 * math.sin(t * 37 + seed * 2)) * scale
        pts.append((x + rnd.uniform(-4, 4), y + rnd.uniform(-4, 4)))
    d.line(pts, fill=(28, 40, 92, 255), width=9 * scale // 2, joint="curve")
    d.line([(120 * scale, 250 * scale), (780 * scale, 222 * scale)], fill=(28, 40, 92, 255), width=3 * scale)
    img = img.resize((900, 320), Image.LANCZOS)
    img.save(path, "PNG")


# ---------------------------------------------------------------- terms (stored already split into pages, US-041)

def load_terms(lang):
    path = HERE / "terms" / f"cgv-{lang}-v1.md"
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    text = text.split("## Notes de transcription")[0]
    text = re.sub(r"^# .*\n", "", text, count=1, flags=re.M)
    pages = []
    for part in text.split("<!-- page -->"):
        html = markdown.markdown(part.strip(), extensions=["sane_lists"])
        html = html.replace("[…]", '<span class="gap">[…]</span>')
        pages.append(html)
    return pages


# ---------------------------------------------------------------- view model

def effective(data):
    """Contract values after the amendments, for the Retour calculations."""
    eff = {"planned_return_at": data["contract"]["planned_return_at"],
           "rental_days": data["contract"]["rental_days"],
           "km_included": data["contract"]["rates"]["km_included"]}
    for a in data.get("amendments", []):
        for ch in a["changes"]:
            if ch["field"] == "planned_return":
                eff["planned_return_at"] = ch["after"]
            elif ch["field"] in eff:
                eff[ch["field"]] = ch["after"]
    return eff


def build_view(data, stage, t, f, pics):
    blank = stage == "blank"
    c = data["contract"]
    r, ad, veh = data["renter"], data["additional_driver"], data["vehicle"]
    dep = data["departure"]
    ret = data.get("return") if stage == "final" else None
    v = {}
    E = lambda val: "" if blank else val  # noqa: E731

    v["pickup_place"] = E(c["pickup_place"])
    v["pickup_at"] = E(f.datetime(c["pickup_at"]))
    v["return_place"] = E(c["return_place"])
    v["planned_return"] = E(f.datetime(c["planned_return_at"]))
    v["rental_days"] = E(c["rental_days"])
    v["flight_train"] = E(c["flight_train"])
    v["intermediary"] = E(c["intermediary"])
    v["intermediary_phone"] = E(c["intermediary_phone"])
    v["signed_terms_note"] = t["signed_terms_note"] if (stage == "final" and data.get("amendments")) else ""

    v["civility"] = E(t["civility"].get(r["civility"], ""))
    v["first_name"], v["last_name"] = E(r["first_name"]), E(r["last_name"])
    v["renter_name"] = E(f'{t["civility"].get(r["civility"], "")} {r["first_name"]} {r["last_name"]}'.strip())
    v["birth_date"] = E(f.date(r["birth_date"]))
    v["birth_place"] = E(r["birth_place"])
    for k in ("email", "phone", "street", "postcode", "city", "state", "country", "local_address", "local_phone",
              "id_doc_number", "id_doc_country", "licence_number", "additional_info"):
        v[k] = E(r.get(k, ""))
    v["id_doc_type"] = None if blank else r["id_doc_type"]
    v["id_doc_dates"] = E(f"{f.date(r['id_doc_issued'])} – {f.date(r['id_doc_expires'])}")
    v["licence_dates"] = E(f"{f.date(r['licence_issued'])} – {f.date(r['licence_expires'])}")

    v["driver_name"] = E(f'{t["civility"].get(ad["civility"], "")} {ad["first_name"]} {ad["last_name"]}'.strip())
    v["driver_birth_date"] = E(f.date(ad["birth_date"]))
    v["driver_licence"] = E(ad["licence_number"])

    v["make_model"], v["plate"], v["colour"] = E(veh["make_model"]), E(veh["plate"]), E(veh["colour"])
    v["fuel_type"] = E(t["fuel_types"].get(veh["fuel_type"], ""))
    v["agent_departure"] = E(dep["agent"])

    rt = c["rates"]
    v["rate_1_3"], v["rate_4_7"] = E(f.money(rt["rate_1_3"])), E(f.money(rt["rate_4_7"]))
    v["extra_day_1"], v["extra_day_2"] = E(f.money(rt["extra_day_1"])), E(f.money(rt["extra_day_2"]))
    v["km_included"] = E(f.km(rt["km_included"]))
    v["package"] = E(f'{f.money(rt["package_price"])} {fill(t["rates"]["package_for"], days=rt["package_days"])}')
    v["extra_km"] = E(f.per_km(rt["extra_km"]))
    v["deductible_card"] = None if blank else c["deductible"]["card_brand"]
    v["deductible_theft"] = E(f.money(c["deductible"]["theft"]))
    v["deductible_accident"] = E(f.money(c["deductible"]["accident"]))
    v["services_included"] = E(c["services_included"])
    v["deposit"] = E(f.money(c["deposit"]))
    pay = c["payment"]
    v["payment_method"] = None if blank else pay["method"]
    v["card"] = E(f'{t["card_brands"].get(pay["card_brand"], "")} •••• {pay["last4"]}')
    v["card_expiry"] = E(pay["expiry"])

    pd, pf = c["pricing_departure"], (c["pricing_final"] if stage == "final" else {})
    vat_label = fill(t["pricing"]["vat"], rate=data["_company"]["vat_rate"])
    lines = [("rental", ""), ("extra_days", ""), ("extra_km", ""), ("rental_total_ht", ""), ("under_25", ""),
             ("extra_driver", ""), ("delivery", ""), ("option_1", ""), ("option_2", ""), ("option_3", ""),
             ("fuel", ""), ("misc", ""), ("total_ht", "total"), ("vat", "total"), ("total_ttc", "grand"),
             ("total_prepaid", "total"), ("balance", "grand")]
    v["pricing_lines"] = [{"label": vat_label if k == "vat" else t["pricing"][k], "cls": cls,
                           "dep": E(f.money(pd.get(k))), "fin": E(f.money(pf.get(k)))} for k, cls in lines]

    # inspection
    eff = effective(data) if stage == "final" else {"km_included": rt["km_included"]}
    v["dep_at"] = E(f.datetime(dep["at"]))
    v["km_out"] = E(f.km(dep["km"]))
    v["fuel_out"] = None if blank else dep["fuel"]
    v["fuel_out_text"] = E(f.fuel(dep["fuel"]))
    chk = ("car_papers", "clean_inside", "clean_outside", "gps")
    v["dep_check"] = {k: (None if blank else dep[k]) for k in chk}
    v["ref_set_date"] = "" if blank else fill(t["inspection"]["reference_set_of"], date=f.date(dep["reference_set"]["taken_at"]))
    v["ref_photos"] = [] if blank else [
        {"thumb": pics[p["id"]]["thumb"], "caption": t["angles"][p["angle"]], "imported": False}
        for p in dep["reference_set"]["photos"]]
    more = []
    if not blank:
        more.append({"thumb": pics[dep["dashboard_photo"]["id"]]["thumb"], "caption": t["inspection"]["dashboard"], "imported": False})
        for p in dep["extra_photos"]:
            more.append({"thumb": pics[p["id"]]["thumb"], "caption": p["comment"], "imported": p.get("imported", False)})
    v["dep_more_photos"] = more
    v["open_damages"] = [] if blank else [
        {"thumb": pics[dmg["photos"][0]["id"]]["thumb"], "comment": dmg["comment"],
         "when": f.date(dmg["found_on"]), "extra_photos": len(dmg["photos"]) - 1}
        for dmg in dep["open_damages"]]
    v["dep_comment"] = E(dep.get("comment", ""))
    v["none_text"] = "" if blank else t["inspection"]["none"]

    v["has_return"] = ret is not None
    v["pending_return_text"] = t["inspection"]["pending_return"] if stage == "departure" else ""
    v["agent_return"] = ret["agent"] if ret else ""
    v["ret_at"] = f.datetime(ret["at"]) if ret else ""
    if ret:
        driven = ret["km"] - dep["km"]
        v["km_in"], v["km_driven"] = f.km(ret["km"]), f.km(driven)
        v["km_included_eff"] = f.km(eff["km_included"])
        v["km_billed"] = f.km(max(0, driven - eff["km_included"]))
        v["fuel_in"], v["fuel_in_text"] = ret["fuel"], f.fuel(ret["fuel"])
        v["ret_check"] = {k: ret[k] for k in chk}
        v["ras"] = ret["ras"]
        v["new_damages"] = [
            {"thumb": pics[dmg["photos"][0]["id"]]["thumb"], "comment": dmg["comment"],
             "when": f.datetime(dmg["photos"][0]["taken_at"]), "extra_photos": len(dmg["photos"]) - 1}
            for dmg in ret["new_damages"]]
        v["ret_more_photos"] = [{"thumb": pics[ret["dashboard_photo"]["id"]]["thumb"],
                                 "caption": t["inspection"]["dashboard"], "imported": False}]
        v["ret_comment"] = ret.get("comment", "")
    else:
        v.update({"km_in": "", "km_driven": "", "km_included_eff": "", "km_billed": "", "fuel_in": None,
                  "fuel_in_text": "", "ret_check": {k: None for k in chk}, "ras": False, "new_damages": [],
                  "ret_more_photos": [], "ret_comment": ""})
    v["has_photos"] = not blank
    return v


def annex_figures(data, stage, t, f, pics):
    if stage == "blank":
        return []
    dep, figs = data["departure"], []
    sd, sr = t["annex"]["stage_departure"], t["annex"]["stage_return"]
    kinds = t["photo_kinds"]
    for p in dep["reference_set"]["photos"]:
        figs.append((p["id"], f'{sd} · {kinds["reference"]} · {t["angles"][p["angle"]]}', "", dep["reference_set"]["taken_at"], False))
    figs.append((dep["dashboard_photo"]["id"], f'{sd} · {kinds["dashboard"]}', "", dep["dashboard_photo"]["taken_at"], False))
    for p in dep["extra_photos"]:
        figs.append((p["id"], f'{sd} · {kinds["extra"]}', p["comment"], p["taken_at"], p.get("imported", False)))
    for dmg in dep["open_damages"]:
        for p in dmg["photos"]:
            figs.append((p["id"], f'{sd} · {kinds["damage"]}', dmg["comment"], p["taken_at"], p.get("imported", False)))
    ret = data.get("return") if stage == "final" else None
    if ret:
        for dmg in ret["new_damages"]:
            for p in dmg["photos"]:
                figs.append((p["id"], f'{sr} · {kinds["damage"]}', dmg["comment"], p["taken_at"], p.get("imported", False)))
        figs.append((ret["dashboard_photo"]["id"], f'{sr} · {kinds["dashboard"]}', "", ret["dashboard_photo"]["taken_at"], False))
    total = len(figs)
    out = []
    for i, (pid, title, comment, taken, imported) in enumerate(figs, start=1):
        meta = f'{fill(t["annex"]["taken"], date=f.datetime(taken))} · {fill(t["annex"]["photo_n"], n=i, total=total)}'
        out.append({"src": pics[pid]["full"], "title": title, "comment": comment, "meta": meta, "imported": imported})
    return out


def make_pictures(data, folder):
    """Draw every placeholder photo and signature the specimen refers to."""
    pics, seed = {}, 7
    dep, ret = data["departure"], data["return"]

    def add(pid, label, kind, **kw):
        nonlocal seed
        seed += 1
        full = folder / f"{pid}.jpg"
        thumb = draw_photo(full, label, kind, seed=seed, **kw)
        pics[pid] = {"full": full.name, "thumb": thumb.name}

    for p in dep["reference_set"]["photos"]:
        add(p["id"], p["angle"].replace("_", " "), "reference", angle=p["angle"])
    add(dep["dashboard_photo"]["id"], "dashboard", "dashboard", km=dep["km"], fuel=dep["fuel"])
    for p in dep["extra_photos"]:
        add(p["id"], "extra photo", "extra")
    for dmg in dep["open_damages"]:
        for p in dmg["photos"]:
            add(p["id"], "damage", "damage")
    for dmg in ret["new_damages"]:
        for p in dmg["photos"]:
            add(p["id"], "damage glass", "damage")
    add(ret["dashboard_photo"]["id"], "dashboard", "dashboard", km=ret["km"], fuel=ret["fuel"])
    draw_signature(folder / "sig-departure.png", 3)
    draw_signature(folder / "sig-return.png", 11)
    return pics


# ---------------------------------------------------------------- pages

def build_pages(data, stage, t, f, pics):
    v = build_view(data, stage, t, f, pics)
    dep_sig = data["departure"]["signature"]
    ret = data.get("return") if stage == "final" else None

    def box(label, image=None, text="", when=""):
        return {"label": label, "image": image, "text": text, "when": when}

    dep_box = box(t["sig"]["departure"]) if stage == "blank" else box(
        t["sig"]["departure"], "sig-departure.png", "", fill(t["sig"]["signed_on"], date=f.datetime(dep_sig["signed_at"])))
    ret_box = box(t["sig"]["return"]) if not ret else box(
        t["sig"]["return"], "sig-return.png", "", fill(t["sig"]["signed_on"], date=f.datetime(ret["signature"]["signed_at"])))

    pages = [
        {"kind": "contract", "title": t["titles"]["contract"],
         "sigtext_title": t["contract_declaration"]["title"], "sigtext": t["contract_declaration"]["text"]},
        {"kind": "financial", "title": t["titles"]["financial"],
         "sigtext_title": t["acceptance"]["title"], "sigtext": t["acceptance"]["text"]},
        {"kind": "inspection", "title": t["titles"]["inspection"],
         "sigtext_title": t["inspection"]["declaration_title"], "sigtext": t["inspection"]["declaration"]},
    ]
    terms_pages = load_terms(t["lang"]) or [None]
    for html in terms_pages:
        pages.append({"kind": "terms", "title": t["titles"]["terms"], "html": html, "sigtext_title": "",
                      "sigtext": fill(t["terms"]["version"], v=data["terms_versions"].get(t["lang"])) if html else ""})
    for p in pages:
        p["sig_left"], p["sig_right"] = dep_box, ret_box
    if stage == "final":
        labels = t["amendment"]["fields"]
        for a in data.get("amendments", []):
            def show(field, val):
                if field == "planned_return":
                    return f.datetime(val)
                if field == "km_included":
                    return f.km(val)
                return str(val)
            av = {"at": f.datetime(a["at"]), "revision": a["revision"], "agent": a["agent"], "reason": a["reason"],
                  "changes": [{"label": labels.get(ch["field"], ch["field"]), "before": show(ch["field"], ch["before"]),
                               "after": show(ch["field"], ch["after"])} for ch in a["changes"]]}
            left = box(fill(t["sig"]["amendment"], n=a["n"]), "sig-amendment.png" if a["client_signed"] else None,
                       "" if a["client_signed"] else t["sig"]["no_client_signature"], f.datetime(a["at"]))
            pages.append({"kind": "amendment", "title": fill(t["titles"]["amendment"], n=a["n"]), "a": av,
                          "sigtext": "", "sig_left": left, "sig_right": ret_box})
    figs = annex_figures(data, stage, t, f, pics)
    for i in range(0, len(figs), 2):
        pages.append({"kind": "photos", "title": t["titles"]["photos"], "figures": figs[i:i + 2], "sigtext": "",
                      "sig_left": dep_box, "sig_right": ret_box})
    total = len(pages)
    for n, p in enumerate(pages, start=1):
        p["no"] = n
        p["page_label"] = fill(t["footer"]["page"], n=n, total=total)
    return pages, v


# Every page is a fixed A4 block with overflow hidden, so text that doesn't fit would be cut without
# notice. This lists each page body (and each two-column terms block) whose content is larger than its box.
OVERFLOW_JS = """() => {
  const out = [];
  document.querySelectorAll('section.page').forEach((pg, i) => {
    pg.querySelectorAll('main.pb, .terms').forEach(el => {
      const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
      if (dy > 1 || dx > 1) out.push({page: i + 1, what: el.className, by: Math.max(dx, dy)});
    });
  });
  return out;
}"""


def render(data, stage, lang, out_pdf, workdir, pics, browser):
    t = json.loads((HERE / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
    f = Fmt(t)
    co = data["_company"]
    pages, v = build_pages(data, stage, t, f, pics)
    revision = "" if stage == "blank" else (max([1] + [a["revision"] for a in data.get("amendments", [])]) if stage == "final" else 1)
    stage_label = t["meta"][{"blank": "stage_blank", "departure": "stage_departure", "final": "stage_final"}[stage]]
    issued = data["generated_at"] if stage == "final" else data["departure"]["signature"]["signed_at"]
    terms_v = data["terms_versions"].get(lang)
    terms_label = terms_v if terms_v and load_terms(lang) else t["footer"]["terms_none"]
    doc = {"number": "" if stage == "blank" else data["contract"]["number"], "revision": revision,
           "stage_label": stage_label, "specimen": True,
           "generated": "" if stage == "blank" else fill(t["footer"]["generated"], date=f.datetime(issued),
                                                          tpl=data["template_version"], terms=terms_label)}
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(HERE / "template")), autoescape=True)
    html = env.get_template("contract.html.j2").render(
        t=t, co=co, doc=doc, pages=pages, v=v, css=(HERE / "template" / "contract.css").read_text(encoding="utf-8"))
    page_file = workdir / f"{out_pdf.stem}.html"
    page_file.write_text(html, encoding="utf-8")
    page = browser.new_page()
    page.goto(page_file.as_uri())
    page.evaluate("document.fonts.ready")
    clipped = page.evaluate(OVERFLOW_JS)
    page.pdf(path=str(out_pdf), prefer_css_page_size=True, print_background=True)
    page.close()
    for c in clipped:
        print(f"  WARNING {out_pdf.name}: page {c['page']} cuts content ({c['what']}, {c['by']} px)")
    return len(pages)


def main():
    from playwright.sync_api import sync_playwright

    data = json.loads((SAMPLES / "specimen.json").read_text(encoding="utf-8"))
    data["_company"] = json.loads((HERE / "config" / "company.json").read_text(encoding="utf-8"))
    keep_html = "--html" in sys.argv
    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        pics = make_pictures(data, work)
        jobs = [("final", "fr", "specimen-final-fr.pdf"), ("final", "en", "specimen-final-en.pdf"),
                ("departure", "fr", "specimen-depart-fr.pdf"), ("blank", "fr", "modele-vierge-fr.pdf")]
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for stage, lang, name in jobs:
                n = render(copy.deepcopy(data), stage, lang, SAMPLES / name, work, pics, browser)
                print(f"{name}: {n} pages")
            browser.close()
        if keep_html:
            out = SAMPLES / "_html"
            out.mkdir(exist_ok=True)
            for item in work.iterdir():
                (out / item.name).write_bytes(item.read_bytes())


if __name__ == "__main__":
    main()
