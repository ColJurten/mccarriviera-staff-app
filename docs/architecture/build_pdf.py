#!/usr/bin/env python3
"""Build architecture.pdf from the PlantUML sources in this folder.

Usage (from the repository root):
    PLANTUML_JAR=/path/to/plantuml.jar python3 docs/architecture/build_pdf.py

Needs Java 17+, Graphviz, the Inter font, and Python 3 with Playwright (Chromium).
It renders every NN-*.puml to svg/, lays the diagrams out on the pages below and prints
them to architecture.pdf with Chromium. Edit the .puml files and the page texts here,
never the PDF or the SVG files.
"""
import html
import os
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SVG_DIR = HERE / "svg"
OUT = HERE / "architecture.pdf"
VERSION = "Version 1.3 · 3 November 2026"
DOC = "MC Car Riviera staff app · planned architecture"

# ---------------------------------------------------------------- page content

ACCOUNTS = [
    ("company", "Company's account (Apple)"),
    ("developer", "Developer's accounts (F-02)"),
    ("device", "Phone or computer"),
    ("option", "Option still open (F-11)"),
]
ACCOUNTS_NO_OPTION = ACCOUNTS[:3]
OPTION_COLOURS = [
    ("developer", "Run by a provider"),
    ("you", "Built or run by the developer"),
    ("plain", "S3-compatible bucket"),
]

PAGES = [
    {"kind": "cover"},
    {
        "uml": "deployment",
        "title": "System overview: what runs where",
        "subtitle": "UML deployment diagram · the app in daily use",
        "diagrams": ["01-system-overview"],
        "layout": "side",
        "legend": ACCOUNTS_NO_OPTION,
        "notes": [
            "The same app runs on the iPhones and, as a web app, on the staff laptops and the agency computer (F-19). No local database and no offline mode; only PDFs to share sit in the iPhone's cache, for 7 days at most.",
            "Every call goes over HTTPS to the developer's own API at Scaleway, in Paris, at mcr.developerworkshop.online. The app holds only its session (Keychain on the iPhone, a protected cookie on the web), never a database password, a storage key or Documenso's token.",
            "The client signs on Documenso's page, opened in a private web view. Documenso seals the PDF and tells the API, which stores it and closes the step in one transaction.",
            "Files are private. The app reaches them through presigned links, issued by the API, that expire within 5 minutes.",
            "A nightly job on the server copies both databases and the new files, encrypted, to a second EU provider. Its key can't delete anything there.",
        ],
        "refs": "ADR-0005 · ADR-0012 · ADR-0013 · ADR-0014 · ADR-0015 · ADR-0017 · ADR-0019 · ADR-0020",
    },
    {
        "uml": "deployment",
        "title": "Build, release and development",
        "subtitle": "UML deployment diagram · from the developer's PC to the staff phones",
        "diagrams": ["02-build-and-release"],
        "layout": "side",
        "legend": ACCOUNTS_NO_OPTION,
        "notes": [
            "No Mac: EAS Build compiles the iOS app in the cloud. Builds are started on purpose; the free plan includes 15 iOS builds a month.",
            "Every build is installed by Ad Hoc internal distribution, signed with the company's Apple certificate. EAS holds it through the developer's Admin access; if the collaboration ends, the company revokes it and issues a new one.",
            "Staging runs on a VM on the developer's homelab, with synthetic data only. It serves the test iPhone and the Android emulator; production, at Scaleway, serves only the two staff phones.",
            "CI checks every pull request, including contract PDFs rendered with Chromium. Staging is deployed on merge to main; production on a release tag after manual approval. JavaScript-only fixes go out as EAS Updates.",
        ],
        "refs": "ADR-0002 · ADR-0003 · ADR-0016 · ADR-0018 · ADR-0019 · US-001 · US-004 · US-005",
    },
    {
        "uml": "component",
        "title": "Front end: the iOS app and the web app",
        "subtitle": "UML component diagram · one Expo codebase for iOS and the web; each screen lists the stories that build it",
        "diagrams": ["03-app-components"],
        "layout": "below",
        "notes": [
            "One codebase for the iPhone and the web (F-19). Screens are in French, built with translation keys so English can be added later.",
            "Server data is kept in memory only (TanStack Query, no persister). Forms are checked with zod before anything is sent.",
            "The app renders no PDF and has no signature pad: it shows the API's preview, with a French / English switch, then opens Documenso's signing page in a private web view.",
            "Photos are resized and stripped of their location before upload. The session token is in the Keychain. Crash reports carry no personal data.",
        ],
        "refs": "ADR-0002 · ADR-0010 · ADR-0011 · ADR-0012 · ADR-0013 · ADR-0017 · ADR-0020",
    },
    {
        "uml": "component",
        "title": "Back end: the developer's API and Documenso",
        "subtitle": "UML component diagram · Scaleway, Paris; the API checks every request, the database enforces the rules",
        "diagrams": ["04-backend-components"],
        "layout": "below",
        "notes": [
            "Every route needs an active staff session (better-auth), denied by default; a test lists every route. Revoking a session works at once.",
            "Every status change (sign, close, amend, void, maintenance) is one SQL function running in one transaction, so two phones can't rent the same car. Status columns are read-only for the API's role, evidence tables accept inserts only, and audit triggers record every write.",
            "Documenso runs unmodified next to the API. The API creates the envelopes, receives the webhook, and stores the sealed PDF before the contract changes state.",
            "The API's storage key can't delete evidence. Database credentials, storage keys, Documenso's token and the signing certificate live only on the server and in protected CI environments.",
        ],
        "refs": "ADR-0007 · ADR-0012 · ADR-0014 · ADR-0015 · ADR-0016 · ADR-0019 · ADR-0020 · US-004 · US-006 · US-043",
    },
    {
        "uml": "class",
        "title": "Database: the 17 tables",
        "subtitle": "UML class diagram · overview; the fields are on the next three pages",
        "diagrams": ["05-data-overview"],
        "layout": "below",
        "notation": True,
        "notes": [
            "Working table names from US-006. Once the migrations exist they are the reference, and these diagrams follow them.",
            "A contract is a header plus numbered revisions. Revision 1 is the Départ as signed; each amendment adds a revision with a full snapshot.",
            "Condition evidence is reused: a Départ's inspection points to the vehicle's current reference photo set and to the damage open at that moment (drawn on « What each handover records »).",
        ],
        "refs": "ADR-0007 · ADR-0008 · US-006",
    },
    {
        "uml": "class",
        "title": "Database detail: fleet, photos, damage, maintenance",
        "subtitle": "UML class diagram · vehicles, condition_baselines, photos, damages, maintenance_records",
        "diagrams": ["06-data-fleet"],
        "layout": "side",
        "notation": True,
        "notes": [
            "A reference set has the 8 exterior angles, all required, plus an optional interior photo. It is taken with the in-app camera.",
            "The optional dashboard photo (km and fuel) belongs to a handover's inspection, not to the reference set: reused later, it would show an old odometer reading.",
            "Finishing a damage repair closes the repaired damage. The car can be rented again only once a new complete reference set exists.",
            "Photos and reference sets are insert-only. Statuses change only through SQL functions.",
        ],
        "refs": "ADR-0008 · F-10 · US-022 · US-026 · US-080 – US-082",
    },
    {
        "uml": "class",
        "title": "Database detail: clients, contracts and their terms",
        "subtitle": "UML class diagram · clients, client_documents, contracts, contract_drivers, contract_revisions, terms_versions",
        "diagrams": ["07-data-contracts"],
        "layout": "side",
        "notation": True,
        "notes": [
            "Signing freezes revision 1: the client and vehicle values are copied as printed, so later edits to a client or a vehicle never change a signed contract.",
            "Card: brand, last four digits and expiry only. No column can hold a full card number or a CVV (F-09, PCI DSS).",
            "Every amount is typed by staff (F-06). The app computes only km driven and extra km.",
            "Each revision records the French and English terms versions in force when it was signed.",
        ],
        "refs": "ADR-0006 · ADR-0007 · ADR-0011 · US-031 · US-051 · US-052 · US-061",
    },
    {
        "uml": "class",
        "title": "Database detail: what each handover records",
        "subtitle": "UML class diagram · inspections, signatures, contract_documents (grey: drawn in full on earlier pages)",
        "diagrams": ["08-data-evidence"],
        "layout": "below",
        "notation": True,
        "notes": [
            "Each signature has an evidence record: Documenso's envelope and signer IDs, the sealed PDF it is in, server time, staff member, device, iOS and app versions, and the hash of the data that was signed. The departure image is read back for the final PDF (F-17).",
            "Every PDF is archived with its SHA-256, its template version and its terms version. Copies (US-063) point to the sealed original.",
            "Completed inspections, signatures and PDF records are insert-only. Until the client signs, the Retour's km, fuel, amounts and comments can still be corrected; whether a photo or a damage entry can be taken back is open (R-10 Q5).",
        ],
        "refs": "ADR-0007 · ADR-0010 · ADR-0014 · ADR-0020 · US-044 · US-053 · US-057 · US-072 · US-074",
    },
    {
        "uml": "state",
        "title": "Lifecycle of a contract",
        "subtitle": "UML state machine · every transition is an SQL function called by the API, recorded in the audit trail",
        "diagrams": ["09-contract-states"],
        "layout": "side",
        "notes": [
            "A draft never changes the vehicle's status. Before the preview it can be discarded; once the preview reserves a number, it can only be cancelled, and is kept as « Annulé avant signature » (F-18).",
            "Signing the Départ confirms the number, freezes revision 1 and marks the car rented, in one transaction.",
            "An amendment adds a revision, signed by the client or recorded « sans signature du client » (default for R-11).",
            "A contract can be voided, with a reason, only before its Retour. The app never deletes a signed contract.",
        ],
        "refs": "ADR-0007 · ADR-0020 · US-056 · US-057 · US-061 · US-062 · US-074",
    },
    {
        "uml": "state",
        "title": "Lifecycle of a vehicle",
        "subtitle": "UML state machine · the labels in « » are what staff see in the app",
        "diagrams": ["10-vehicle-states"],
        "layout": "side",
        "notes": [
            "A Départ is offered only for available cars with a complete reference photo set.",
            "Routine maintenance needs no new photos. After a damage repair, a new complete reference set is required before the car is available again.",
            "Only an available car, or one in maintenance, can be archived. « Restaurer » brings it back; nothing is deleted.",
            "Statuses change only through SQL functions, in the same transaction as the contract or maintenance change.",
        ],
        "refs": "ADR-0007 · ADR-0008 · US-022 · US-025 · US-080 – US-082",
    },
    {
        "uml": "sequence",
        "title": "Départ: from choosing the car to the sealed PDF",
        "subtitle": "UML sequence diagram · US-050 to US-057, US-044",
        "diagrams": ["11-sequence-depart"],
        "layout": "portrait",
        "notes": [
            "The language is chosen in the preview, and can be switched until the client signs (F-17). The PDF carries its contract number already, so the number is reserved at the preview (F-18).",
            "The client draws once in Documenso, and the drawing fills the signature box of every page. Documenso seals the PDF with the company's certificate.",
            "The contract becomes active only once the sealed PDF is stored, in one transaction. If the car was taken meanwhile, nothing is signed in the app.",
        ],
        "refs": "ADR-0005 · ADR-0007 · ADR-0010 · ADR-0020",
    },
    {
        "uml": "sequence",
        "title": "Retour: check-in, mandatory signature, final PDF",
        "subtitle": "UML sequence diagram · US-070 to US-075, US-044",
        "diagrams": ["12-sequence-retour"],
        "layout": "portrait",
        "notes": [
            "The return signature is mandatory (F-04). Without the client, the Retour waits « en attente de signature » and the car stays « En cours ».",
            "Km driven and extra km are the only values the app computes. The final amounts are typed (F-06).",
            "In the final PDF the client signs the « Signature retour » box of every page in Documenso. The « Signature départ » boxes show the departure image read back from Documenso, except on amendment pages (F-08, F-17).",
        ],
        "refs": "ADR-0005 · ADR-0007 · ADR-0010 · ADR-0020 · B-08",
    },
    {"kind": "why", "diagrams": ["13-hosting-options"]},
    {"kind": "options"},
]

UML_KINDS = [
    ("deployment", "Deployment diagram", "where each part runs, and who calls whom"),
    ("component", "Component diagram", "the parts of the software, and what uses what"),
    ("class", "Class diagram", "the tables, their fields and their links"),
    ("state", "State machine", "the statuses, and what moves a record from one to the next"),
    ("sequence", "Sequence diagram", "one workflow, message by message, from top to bottom"),
]

# ---------------------------------------------------------------- helpers

NOWRAP = re.compile(r"(SHA-256|MCR-YYYY-NNNN|ADR-\d{4}|US-\d{3}(?: – US-\d{3})?|[BFRTNL]-\d{2}|PCI DSS|€\d[\d.,–]*|\$\d+)")


def esc(text):
    """Escape text for HTML and keep IDs, prices and hashes on one line."""
    text = html.escape(text, quote=False).replace("« ", "«&nbsp;").replace(" »", "&nbsp;»")
    return NOWRAP.sub(r'<span class="nw">\1</span>', text)


def page_range(pred):
    nums = [i for i, p in enumerate(PAGES, start=1) if pred(p)]
    if not nums:
        return ""
    return str(nums[0]) if nums[0] == nums[-1] else f"{nums[0]}–{nums[-1]}"


def render_svgs():
    jar = os.environ.get("PLANTUML_JAR")
    if not jar:
        sys.exit("Set PLANTUML_JAR to the path of plantuml.jar")
    SVG_DIR.mkdir(exist_ok=True)
    for old in SVG_DIR.glob("*.svg"):
        old.unlink()
    sources = sorted(str(p) for p in HERE.glob("[0-9][0-9]-*.puml"))
    subprocess.run(
        ["java", "-Djava.awt.headless=true", "-jar", jar, "-tsvg", "-charset", "UTF-8",
         "-failfast2", "-o", str(SVG_DIR), *sources],
        check=True,
    )


def inline_svg(name):
    """Return the SVG as inline markup that scales to its box, with ids made unique."""
    svg = (SVG_DIR / f"{name}.svg").read_text(encoding="utf-8")
    svg = re.sub(r"<\?plantuml[^>]*\?>", "", svg)
    svg = re.sub(r"^<\?xml[^>]*>", "", svg)
    prefix = re.sub(r"[^a-z0-9]", "", name.lower())
    svg = re.sub(r'id="([^"]+)"', lambda m: f'id="{prefix}-{m.group(1)}"', svg)
    svg = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}-{m.group(1)})", svg)
    svg = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{prefix}-{m.group(1)}"', svg)
    head, rest = svg.split(">", 1)
    head = re.sub(r'\s(width|height|style|preserveAspectRatio)="[^"]*"', "", head)
    head += ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img"'
    return head + ">" + rest


def legend_html(items, vertical=False):
    chips = "".join(
        f'<span class="chip"><i class="sw {kind}"></i><span>{esc(label)}</span></span>' for kind, label in items
    )
    return f'<div class="legend{" vertical" if vertical else ""}">{chips}</div>'


NOTATION = (
    '<div class="notation"><b>Notation</b>'
    '<span><i class="glyph">◆—</i>part of (belongs to one owner)</span>'
    '<span><i class="glyph">—›</i>refers to</span>'
    '<span><i class="glyph">1 · 0..1 · 0..*</i>how many</span>'
    '<span><i class="glyph">[0..1]</i>optional field</span>'
    '<span><i class="glyph">{…}</i>rule</span></div>'
)


def header(title, subtitle, number):
    return (
        '<header><div class="kicker">MC Car Riviera · staff app · planned architecture</div>'
        f'<h1><span class="num">{number}</span>{esc(title)}</h1>'
        f'<p class="sub">{esc(subtitle)}</p></header>'
    )


def footer(page_no, total, sources, refs=""):
    src = " · ".join(f"{s}.puml" for s in sources) if sources else "build_pdf.py"
    based = f"Based on {esc(refs)}" if refs else "Drawn from the ADRs and stories in docs/"
    return (
        "<footer>"
        f'<div class="row"><span>{esc(DOC)} · {esc(VERSION)}</span><span class="pg">{page_no} / {total}</span></div>'
        f'<div class="row small"><span class="refs">{based}</span><span>source: docs/architecture/{esc(src)}</span></div>'
        "</footer>"
    )


def notes_html(notes, columns=0):
    items = "".join(f"<li>{esc(n)}</li>" for n in notes)
    if columns:
        return f'<ul class="notes cols" style="grid-template-columns: repeat({columns}, 1fr)">{items}</ul>'
    return f'<ul class="notes">{items}</ul>'


# ---------------------------------------------------------------- pages


def cover_page(total):
    why = page_range(lambda p: p.get("kind") in ("why", "options"))
    glance = [
        ("Front end", "One iOS app in Expo · React Native · TypeScript, built in the cloud with EAS (no Mac needed). Installed on the two staff iPhones by Ad Hoc distribution. Online only: no business data is kept on the phones."),
        ("Back end", "The developer's own API (TypeScript, Fastify) at Scaleway, Paris: logins, a check on every request, 5-minute links to private files, PDF rendering. Staging on his homelab."),
        ("Database", "Managed PostgreSQL, 17 tables. Status changes through SQL functions only; signed data insert-only; every write audited."),
        ("Signatures", "Self-hosted Documenso: the client draws once, it fills every page, and the PDF is sealed with the company's certificate."),
        ("Contract PDF", "Rendered by the API with Chromium, in the language chosen in the preview. Archived with its SHA-256."),
        ("Operations", "Nightly encrypted backup to a second EU provider, Sentry EU without personal data, deployments by CI."),
        ("Accounts", "Apple: the company. Expo, GitHub, Scaleway, backups, Sentry: the developer (F-02), who pays the hosting (F-07)."),
        ("Still open", f"F-14 Q3, F-15, F-18; the Documenso spike (US-009); legal checks L-01 to L-07. F-11 decided: C (pages {why})."),
    ]
    rows = "".join(f"<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in glance)
    contents = []
    for i, p in enumerate(PAGES[1:], start=2):
        title = p.get("title") or {"why": "Why an API between the phone and Postgres (F-11)",
                                   "options": "Hosting options compared (F-11: C chosen)"}[p["kind"]]
        contents.append(f"<li><span>{esc(title)}</span><b>{i}</b></li>")
    read = "".join(
        f"<div class='read-item'><div><b>{esc(name)}</b><span class='pg'>p. {page_range(lambda p, k=kind: p.get('uml') == k)}</span></div>"
        f"<span>{esc(what)}</span></div>"
        for kind, name, what in UML_KINDS
    )
    return f"""
<section class="page cover">
  <div class="cover-top">
    <div class="kicker">MC Car Riviera · staff app</div>
    <h1 class="title">Planned architecture</h1>
    <p class="lead">UML diagrams of the iOS app, the back end and the database, and the hosting
    options compared for F-11 (option C chosen). Drawn from the decisions (ADRs) and stories in <code>docs/</code>.</p>
    <p class="meta">{esc(VERSION)} · own API, Postgres and S3 at Scaleway; signatures with Documenso · kept up to date by US-004, US-006, US-050 and US-070</p>
  </div>
  <div class="cover-grid">
    <div>
      <h2>At a glance</h2>
      <table class="glance">{rows}</table>
    </div>
    <div>
      <h2>Contents</h2>
      <ol class="contents">{''.join(contents)}</ol>
    </div>
    <div>
      <h2>How to read the diagrams</h2>
      <div class="read">{read}</div>
      <h2>Colours</h2>
      {legend_html(ACCOUNTS_NO_OPTION, vertical=True)}
    </div>
  </div>
  {footer(1, total, [])}
</section>"""


def diagram_page(p, page_no, total):
    layout = p["layout"]
    top = header(p["title"], p["subtitle"], page_no)
    legend = legend_html(p["legend"]) if p.get("legend") else ""
    notation = NOTATION if p.get("notation") else ""
    dia = f'<div class="dia">{inline_svg(p["diagrams"][0])}</div>'
    if layout == "side":
        legend_side = legend_html(p["legend"], vertical=True) if p.get("legend") else ""
        body = (
            f'<div class="body side">{dia}'
            f'<aside>{legend_side}<h3>Key points</h3>{notes_html(p["notes"])}{notation}</aside></div>'
        )
    elif layout == "below":
        body = (
            f'<div class="body below">{dia}'
            f'<div class="under">{notes_html(p["notes"], columns=len(p["notes"]))}{notation}{legend}</div></div>'
        )
    elif layout == "portrait":
        body = f'<div class="body below">{dia}<div class="under">{notes_html(p["notes"])}</div></div>'
    else:
        raise ValueError(layout)
    cls = "page portrait" if layout == "portrait" else "page"
    return f'<section class="{cls}">{top}{body}{footer(page_no, total, p["diagrams"], p.get("refs", ""))}</section>'


WHY_CARDS = [
    ("Traffic isn't what costs money",
     "Two staff members and a few dozen requests per handover are nothing for any of these options. What costs money is storing the files, and the security layer someone has to build and run."),
    ("The phone can't talk to Postgres directly",
     "It would need a database password on two personal phones, and Postgres open to the internet. Something must sit in between: sign staff in, check every request against the access rules, and hand out short-lived links to private files. With option C, that layer is the developer's own API."),
    ("What C costs",
     "About €25–30 a month: the managed Postgres (about €11), a server with at least 4 GB of RAM for the API and Documenso (about €15), cents for the files. And weeks of extra work: logins, permissions, file links, deployment, monitoring."),
    ("What C gives",
     "No free-plan pause or quota, the data on infrastructure the developer controls, in France, one language from the app to the API, and room for Documenso next to the API."),
]


def why_page(p, page_no, total):
    top = header("Why an API between the phone and Postgres (F-11)",
                 "Your question of 9 October, answered on 3 November with option C · the four options side by side", page_no)
    cards = "".join(f'<div class="card"><h3>{esc(t)}</h3><p>{esc(b)}</p></div>' for t, b in WHY_CARDS)
    body = (
        f'<div class="body why"><div class="cards">{cards}</div>'
        f'<div class="dia">{inline_svg(p["diagrams"][0])}</div>'
        f'<div class="under">{legend_html(OPTION_COLOURS)}</div></div>'
    )
    return f'<section class="page">{top}{body}{footer(page_no, total, p["diagrams"], "F-11 · ADR-0004 · ADR-0019 · ADR-0014")}</section>'


OPTION_HEADS = [
    ("A · Supabase for everything", "the plan until 3 November"),
    ("B · Supabase + S3 for the files", "recommended on 9 October"),
    ("C · Managed Postgres + S3 + own API", "chosen on 3 November"),
    ("D · Everything on one server", "cheapest, most to run"),
]
OPTION_ROWS = [
    ("What runs where",
     ["Logins, database, API and files on Supabase (EU)",
      "Logins, database and API on Supabase Free; files in an EU S3-compatible bucket (e.g. Scaleway, Paris)",
      "Managed Postgres, a small server for your own API, and an S3 bucket",
      "One small server (e.g. Hetzner CX23, €5.49) with Postgres and an API, or self-hosted Supabase; files in S3"]),
    ("Per month, under 1 GB of files", ["€0", "€0 + cents", "≈ €17; ≈ €25–30 with Documenso on a 4 GB server", "≈ €6–8"]),
    ("Per month after ≈ 200 rentals", ["$25 (Pro)", "Cents: the text data stays under 500 MB for years", "The same, plus cents for files", "≈ €6–8"]),
    ("Extra work for you",
     ["None", "1–2 days: one function for file links, and the bucket set-up",
      "Weeks: logins, sessions, permissions, the API itself, TLS, monitoring",
      "Days to set up, then updates, security, backups and monitoring of a server holding ID documents"]),
    ("Who patches and watches it", ["Supabase", "Supabase and the bucket provider", "The provider for the database; you for the API server", "You"]),
    ("Limits to know", ["Free plan: no service guarantee; pauses after a week without activity", "Free-plan limits for the database, as in A", "None of the free-plan limits", "Your one server is a single point of failure"]),
]


def options_page(p, page_no, total):
    top = header("Hosting options compared (F-11: C chosen)",
                 "Approximate list prices before VAT, checked on 9 October 2026 · every option stays portable (Postgres dump, S3-compatible files)", page_no)
    thead = "<tr><th></th>" + "".join(
        f'<th class="{"rec" if i == 2 else ""}">{esc(h)}<small>{esc(s)}</small></th>'
        for i, (h, s) in enumerate(OPTION_HEADS)) + "</tr>"
    rows = ""
    for label, cells in OPTION_ROWS:
        rows += f"<tr><th>{esc(label)}</th>" + "".join(
            f'<td class="{"rec" if i == 2 else ""}">{esc(c)}</td>' for i, c in enumerate(cells)) + "</tr>"
    reco = f"""
<div class="reco">
  <div class="decide">
    <h3>Decision (3 November): C</h3>
    <p>Your own API server in TypeScript with Fastify ({esc("F-12")}), a managed Postgres and S3 storage,
    at Scaleway in Paris ({esc("F-14")}), with staging on your homelab. Signatures with a self-hosted
    Documenso next to the API. Recorded in {esc("ADR-0019")} and {esc("ADR-0020")}; Supabase ({esc("ADR-0004")}) is superseded.</p>
  </div>
  <div>
    <h3>What C adds since 9 October</h3>
    <ul>
      <li>A server with at least 4 GB of RAM, since Documenso needs 2 GB on its own: about €25–30 a month in all.</li>
      <li>An e-mail provider, which Documenso needs even with its e-mails to clients switched off ({esc("F-15")}).</li>
      <li>PDF rendering on the server with Chromium ({esc("F-13")}), and the nightly backup run from the server.</li>
    </ul>
  </div>
  <div>
    <h3>Still to watch</h3>
    <ul>
      <li>One server: while it is down, no handover can be signed. Uptime alerts and the paper fallback cover it.</li>
      <li>Scaleway becomes a sub-processor in your data processing agreement with the company ({esc("L-03")}).</li>
    </ul>
  </div>
</div>"""
    sources = ('<p class="sources">Prices: Supabase pricing page (Free and Pro plans) · Scaleway price lists for Object Storage '
               '(€0.01606 per GB a month, Paris, multi-AZ) and Managed Databases (DB-DEV-S, €0.0156 an hour) · '
               'Hetzner\'s cloud price change of 15 June 2026 (CX23 from €3.99 to €5.49 a month). Check them again before committing.</p>')
    body = f'<div class="body opts"><table class="options"><thead>{thead}</thead><tbody>{rows}</tbody></table>{reco}{sources}</div>'
    return f'<section class="page">{top}{body}{footer(page_no, total, [], "F-11 · ADR-0019 · ADR-0020 · ADR-0014 · ADR-0015 · L-03")}</section>'


CSS = """
@page { size: A4 landscape; margin: 0; }
@page portrait { size: A4 portrait; margin: 0; }
:root {
  --ink: #1D2433; --slate: #4A5363; --grey: #9AA3B2; --line: #D9DDE4; --light: #F5F6F8;
  --gold: #A97E22; --gold-bg: #F6EFDC; --blue: #5A6B86; --blue-bg: #EDF1F7;
  --red: #B5523B; --red-bg: #FBE9E7;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #FFFFFF; }
body { font-family: Inter, sans-serif; color: var(--ink); font-size: 8.8pt; line-height: 1.38;
       -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.nw { white-space: nowrap; }
.page { width: 297mm; height: 210mm; padding: 9mm 12mm 6mm; display: flex; flex-direction: column;
        break-after: page; overflow: hidden; position: relative; }
.page.portrait { page: portrait; width: 210mm; height: 297mm; padding: 10mm 11mm 6mm; }
header { flex: none; margin-bottom: 3.5mm; padding-bottom: 2.6mm; border-bottom: 0.3mm solid var(--gold); }
.kicker { font-size: 6.8pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
h1 { font-size: 16pt; line-height: 1.15; margin: 1mm 0 0.6mm; font-weight: 650; letter-spacing: -0.01em; }
h1 .num { display: inline-block; min-width: 9mm; color: var(--gold); font-weight: 600; }
.sub { margin: 0; color: var(--slate); font-size: 8.8pt; }
h2 { font-size: 10.5pt; margin: 0 0 2mm; font-weight: 650; }
h3 { font-size: 8.8pt; margin: 0 0 1.2mm; font-weight: 650; }
.body { flex: 1; min-height: 0; display: flex; gap: 6mm; }
.dia { position: relative; flex: 1; min-height: 0; min-width: 0; }
.dia svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.body.side aside { flex: none; width: 62mm; border-left: 0.25mm solid var(--line); padding-left: 5mm;
                   display: flex; flex-direction: column; gap: 2.2mm; }
.body.side aside h3 { margin-top: 1.5mm; }
.body.below { flex-direction: column; gap: 3mm; }
.under { flex: none; display: flex; flex-direction: column; gap: 2.2mm; border-top: 0.25mm solid var(--line); padding-top: 2.6mm; }
.notes { margin: 0; padding: 0; list-style: none; }
.notes li { position: relative; padding-left: 3.6mm; margin: 0 0 1.5mm; }
.notes li::before { content: ""; position: absolute; left: 0; top: 1.5mm; width: 1.5mm; height: 1.5mm;
                    border-radius: 50%; background: var(--gold); }
.notes.cols { display: grid; column-gap: 7mm; }
.notes.cols li { margin: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 1.6mm 4.5mm; font-size: 7.5pt; color: var(--slate); }
.legend.vertical { flex-direction: column; gap: 1.4mm; }
.chip { display: inline-flex; align-items: center; gap: 1.8mm; white-space: nowrap; }
.sw { display: inline-block; width: 6mm; height: 3.4mm; border-radius: 1mm; flex: none; }
.sw.company { background: var(--gold-bg); border: 0.45mm solid var(--gold); }
.sw.developer { background: var(--blue-bg); border: 0.3mm solid var(--blue); }
.sw.device { background: #FFF; border: 0.45mm solid var(--ink); }
.sw.option { background: #FFF; border: 0.3mm dashed var(--grey); }
.sw.you { background: var(--red-bg); border: 0.45mm solid var(--red); }
.sw.plain { background: #FFF; border: 0.3mm solid var(--slate); }
.notation { display: flex; flex-wrap: wrap; gap: 1.2mm 4.5mm; font-size: 7.5pt; color: var(--slate); }
aside .notation { flex-direction: column; gap: 1mm; margin-top: auto; }
.notation b { color: var(--ink); font-weight: 600; }
.glyph { font-style: normal; font-weight: 600; color: var(--ink); margin-right: 1.5mm; }
footer { flex: none; margin-top: 2.6mm; padding-top: 1.8mm; border-top: 0.25mm solid var(--line);
         font-size: 6.8pt; color: var(--slate); display: flex; flex-direction: column; gap: 0.6mm; }
footer .row { display: flex; justify-content: space-between; gap: 6mm; }
footer .row.small { font-size: 6.4pt; color: var(--grey); }
footer .refs { color: var(--blue); }
footer .pg { font-weight: 600; color: var(--ink); }
code { font-family: "DejaVu Sans Mono", monospace; font-size: 0.9em; background: var(--light); padding: 0 0.8mm; border-radius: 0.6mm; }

/* cover */
.cover { padding: 13mm 14mm 6mm; }
.cover-top { flex: none; border-bottom: 0.4mm solid var(--gold); padding-bottom: 4.5mm; margin-bottom: 6mm; }
.cover .title { font-size: 28pt; margin: 2mm 0 2mm; font-weight: 700; letter-spacing: -0.02em; }
.lead { font-size: 11pt; margin: 0 0 2mm; max-width: 215mm; color: var(--ink); }
.meta { margin: 0; color: var(--slate); font-size: 8.4pt; }
.cover-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.5fr 1fr 0.95fr; gap: 9mm; }
.cover-grid > div { display: flex; flex-direction: column; min-width: 0; }
.cover-grid h2 + * { margin-bottom: 5mm; }
table { border-collapse: collapse; width: 100%; }
.glance th { text-align: left; vertical-align: top; width: 24mm; padding: 1.6mm 3mm 1.6mm 0; color: var(--gold); font-weight: 650; }
.glance td { padding: 1.6mm 0; }
.glance tr + tr th, .glance tr + tr td { border-top: 0.25mm solid var(--line); }
.contents { margin: 0; padding: 0; list-style: none; }
.contents li { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; padding: 1mm 0; border-bottom: 0.2mm dotted var(--grey); }
.contents li b { color: var(--gold); font-weight: 650; }
.read { display: flex; flex-direction: column; gap: 1.6mm; }
.read-item > div { display: flex; justify-content: space-between; gap: 2mm; }
.read-item > span { color: var(--slate); display: block; }
.read-item .pg { color: var(--gold); white-space: nowrap; }

/* why page */
.body.why { flex-direction: column; gap: 3.5mm; }
.cards { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
.card { background: var(--light); border-radius: 2mm; padding: 3mm 3.5mm; border-top: 0.6mm solid var(--gold); }
.card p { margin: 0; }
.body.why .dia { flex: none; }
.body.why .dia svg { position: static; display: block; height: auto; }

/* options page */
.body.opts { flex-direction: column; gap: 4mm; }
.options { flex: none; table-layout: fixed; font-size: 8.2pt; }
.options th, .options td { border: 0.25mm solid var(--line); padding: 1.3mm 2.2mm; vertical-align: top; text-align: left; }
.options thead th { background: var(--light); font-weight: 650; font-size: 8.6pt; }
.options thead th small { display: block; font-weight: 500; color: var(--slate); font-size: 7.4pt; }
.options tbody th { width: 34mm; font-weight: 600; color: var(--slate); background: #FFF; }
.options .rec { background: var(--blue-bg); }
.options thead th.rec { background: #DDE5F0; box-shadow: inset 0 0.8mm 0 var(--blue); }
.reco { flex: none; display: grid; grid-template-columns: 1.15fr 1.1fr 1fr; gap: 5mm; }
.reco > div { background: var(--light); border-radius: 2mm; padding: 2.8mm 3.4mm; }
.reco .decide { background: var(--gold-bg); border: 0.35mm solid var(--gold); }
.reco p { margin: 0 0 1.5mm; }
.reco p.ask { margin: 0; }
.reco ul { margin: 0; padding-left: 4mm; }
.reco li { margin-bottom: 1mm; }
.sources { flex: none; margin: 0; font-size: 7pt; color: var(--slate); }
"""


def build_html():
    total = len(PAGES)
    parts = []
    for i, p in enumerate(PAGES, start=1):
        kind = p.get("kind", "diagram")
        if kind == "cover":
            parts.append(cover_page(total))
        elif kind == "why":
            parts.append(why_page(p, i, total))
        elif kind == "options":
            parts.append(options_page(p, i, total))
        else:
            parts.append(diagram_page(p, i, total))
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>{html.escape(DOC)}</title><style>{CSS}</style></head><body>"
        + "".join(parts)
        + "</body></html>"
    )


def print_pdf(html_text):
    from playwright.sync_api import sync_playwright

    with tempfile.TemporaryDirectory() as tmp:
        page_file = pathlib.Path(tmp) / "architecture.html"
        page_file.write_text(html_text, encoding="utf-8")
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(page_file.as_uri())
            page.evaluate("document.fonts.ready")
            page.pdf(path=str(OUT), prefer_css_page_size=True, print_background=True)
            browser.close()


def main():
    if "--no-render" not in sys.argv:
        render_svgs()
    html_text = build_html()
    if "--html" in sys.argv:
        (HERE / "architecture.html").write_text(html_text, encoding="utf-8")
    print_pdf(html_text)
    print(f"Wrote {OUT} ({len(PAGES)} pages)")


if __name__ == "__main__":
    main()
