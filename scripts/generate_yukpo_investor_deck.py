# -*- coding: utf-8 -*-
"""
Génère Yukpo_Investisseur_Presentation.pptx — pitch investisseur visuel, chiffres documentés.

Source unique des chiffres : docs/investisseurs/YANGO/ONE_PAGER_YANGO.md
(ne pas ajouter de montants inventés ici).
"""
from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt

# --- Données : ONE_PAGER_YANGO.md (ne pas modifier sans mettre à jour le document source) ---
SRC = "docs/investisseurs/YANGO/ONE_PAGER_YANGO.md"

P = {
    "invisible_pct": "85%",
    "cout_site_fcfa": "100K – 1M",
    "apps_count": "2 – 5",
    "creation_min": "5",
    "population_pct": "60%",
    "livraison_reduction": "40 – 60%",
    "tam_billions": 183,
    "sam_low": 1.8,
    "sam_high": 2.7,
    "sam_mid": 2.25,
    "rev_2027_m": 897,
    "rev_2030_billions": 14.6,
    "rev_2030_m": 14600,
    "cac_marchand_low": 15,
    "cac_marchand_high": 25,
    "cac_user_low": 0.5,
    "cac_user_high": 1,
    "ltv_k": 48,
    "ltv_cac": "2,4x",
    "payback_mois": 10,
    "roi_5y": "10 – 15x",
    "renta_annee": "2028",
    "seed_m": 720,
    "seed_eur_m": 1.1,
    "seed_usd_m": 1.2,
    "pct_marketing": 35,
    "m_marketing": 220,
    "pct_ops": 65,
    "m_ops": 500,
    "gap_treso": 640,
    "reserve": 80,
    "users_target_k": 50,
    "merchants_target_k": 5,
    "q3_2026_actifs": 12950,
    "q3_2026_rev_m": 139,
    "2027_actifs": 40761,
    "2027_rev_m": 897,
    "2028_net_m": 13,
    "founder_exp_y": 13,
}

_LOGO_PATH: Path | None = None

SLIDE_W = Inches(10)
SLIDE_H = Inches(7.5)
MARGIN_L = Inches(0.45)
MARGIN_R = Inches(0.38)
TABLE_LEFT = Inches(0.48)
LOGO_H = Inches(0.42)
LOGO_MARGIN = Inches(0.2)
TABLE_W = Inches(10) - TABLE_LEFT - MARGIN_R - LOGO_H - LOGO_MARGIN
TITLE_W = TABLE_W
TITLE_TOP = Inches(0.22)

NAVY = RGBColor(0x1E, 0x3A, 0x5F)
ACCENT = RGBColor(0x2E, 0x6B, 0xC4)
MUTED = RGBColor(0x66, 0x66, 0x66)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BOX_BG = RGBColor(0xE8, 0xEE, 0xF9)


def resolve_logo_path() -> Path | None:
    root = Path(__file__).resolve().parent.parent
    c = root / "mobile" / "assets" / "icon.png"
    return c if c.is_file() else None


def apply_slide_background(slide) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = RGBColor(0xF7, 0xF8, 0xFC)


def add_slide_top_bar(slide) -> None:
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0.0, 0.0, float(SLIDE_W), float(Inches(0.06)))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()


def add_logo_br(slide) -> None:
    if _LOGO_PATH is None or not _LOGO_PATH.is_file():
        return
    left = float(SLIDE_W) - float(LOGO_H) - float(MARGIN_R)
    top = float(SLIDE_H) - float(LOGO_H) - float(MARGIN_R)
    slide.shapes.add_picture(str(_LOGO_PATH), left, top, height=LOGO_H)


def footer(slide, text: str = "Confidentiel — Yukpo — chiffres : ONE_PAGER_YANGO.md") -> None:
    box = slide.shapes.add_textbox(
        float(MARGIN_L), float(SLIDE_H) - float(Inches(0.68)), float(Inches(7.5)), float(Inches(0.26))
    )
    p = box.text_frame.paragraphs[0]
    p.text = text
    p.font.size = Pt(8)
    p.font.color.rgb = MUTED


def stamp(prs: Presentation) -> None:
    total = len(prs.slides)
    for i, slide in enumerate(prs.slides):
        box = slide.shapes.add_textbox(
            float(MARGIN_L), float(SLIDE_H) - float(Inches(0.36)), float(Inches(1.2)), float(Inches(0.26))
        )
        p = box.text_frame.paragraphs[0]
        p.text = f"{i + 1} / {total}"
        p.font.size = Pt(9)
        p.font.color.rgb = RGBColor(0x99, 0x99, 0x99)


def title_block(slide, title: str, subtitle: str | None = None) -> float:
    """Retourne y (pouces) sous le bloc titre pour placer contenu."""
    h = Inches(1.05) if subtitle else Inches(0.72)
    box = slide.shapes.add_textbox(TABLE_LEFT, TITLE_TOP, TITLE_W, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    p0 = tf.paragraphs[0]
    p0.text = title
    p0.font.size = Pt(26)
    p0.font.bold = True
    p0.font.color.rgb = NAVY
    if subtitle:
        p1 = tf.add_paragraph()
        p1.text = subtitle
        p1.font.size = Pt(11.5)
        p1.font.color.rgb = MUTED
        p1.space_before = Pt(6)
    return float(TITLE_TOP) + float(h) + 0.06


def slide_blank(prs: Presentation):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    apply_slide_background(slide)
    add_slide_top_bar(slide)
    return slide


def add_kpi_row(
    slide,
    y_in: float,
    items: list[tuple[str, str, str]],
    foot: str | None = None,
) -> None:
    """3 cartes : grand chiffre, titre court, sous-ligne source."""
    n = len(items)
    gap = Inches(0.14)
    total_w = float(TABLE_W) - float(gap) * (n - 1)
    w = total_w / n
    x0 = float(TABLE_LEFT)
    y = Inches(y_in)
    h = Inches(2.35)
    for i, (big, lab, sub) in enumerate(items):
        x = x0 + i * (w + float(gap))
        sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        sh.fill.solid()
        sh.fill.fore_color.rgb = BOX_BG
        sh.line.color.rgb = ACCENT
        sh.line.width = Pt(1.25)
        tf = sh.text_frame
        tf.clear()
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p0 = tf.paragraphs[0]
        p0.text = big
        p0.font.size = Pt(34 if len(big) < 14 else 28)
        p0.font.bold = True
        p0.font.color.rgb = NAVY
        p0.alignment = PP_ALIGN.CENTER
        p1 = tf.add_paragraph()
        p1.text = lab
        p1.font.size = Pt(12)
        p1.font.bold = True
        p1.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
        p1.alignment = PP_ALIGN.CENTER
        p1.space_before = Pt(10)
        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.size = Pt(9.5)
        p2.font.color.rgb = MUTED
        p2.alignment = PP_ALIGN.CENTER
        p2.space_before = Pt(6)
    if foot:
        bx = slide.shapes.add_textbox(TABLE_LEFT, Inches(y_in + 2.5), TABLE_W, Inches(0.45))
        bx.text_frame.paragraphs[0].text = foot
        bx.text_frame.paragraphs[0].font.size = Pt(9)
        bx.text_frame.paragraphs[0].font.color.rgb = MUTED
        bx.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER


def add_two_kpi_wide(slide, y_in: float, left: tuple[str, str, str], right: tuple[str, str, str]) -> None:
    w = (float(TABLE_W) - float(Inches(0.2))) / 2
    x0 = float(TABLE_LEFT)
    y = Inches(y_in)
    h = Inches(2.5)
    for i, (big, lab, sub) in enumerate((left, right)):
        x = x0 + i * (w + float(Inches(0.2)))
        sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        sh.fill.solid()
        sh.fill.fore_color.rgb = RGBColor(0x1E, 0x3A, 0x5F)
        sh.line.fill.background()
        tf = sh.text_frame
        tf.clear()
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p0 = tf.paragraphs[0]
        p0.text = big
        p0.font.size = Pt(38)
        p0.font.bold = True
        p0.font.color.rgb = WHITE
        p0.alignment = PP_ALIGN.CENTER
        p1 = tf.add_paragraph()
        p1.text = lab
        p1.font.size = Pt(13)
        p1.font.color.rgb = RGBColor(0xDD, 0xE5, 0xF5)
        p1.alignment = PP_ALIGN.CENTER
        p1.space_before = Pt(12)
        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.size = Pt(10)
        p2.font.color.rgb = RGBColor(0xBB, 0xCC, 0xDD)
        p2.alignment = PP_ALIGN.CENTER
        p2.space_before = Pt(8)


def add_chart_column(
    slide,
    title: str,
    categories: list[str],
    series_name: str,
    values: list[float],
    y_sub: str,
    unit_note: str,
) -> None:
    yb = title_block(slide, title, y_sub)
    chart_data = CategoryChartData()
    chart_data.categories = categories
    chart_data.add_series(series_name, values)
    x, y = Inches(0.9), Inches(yb + 0.05)
    cx, cy = Inches(8.2), Inches(4.35)
    graphic_frame = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, x, y, cx, cy, chart_data)
    chart = graphic_frame.chart
    chart.has_title = False
    plot = chart.plots[0]
    plot.has_data_labels = True
    tb = slide.shapes.add_textbox(TABLE_LEFT, Inches(6.55), TABLE_W, Inches(0.5))
    tb.text_frame.paragraphs[0].text = unit_note
    tb.text_frame.paragraphs[0].font.size = Pt(9)
    tb.text_frame.paragraphs[0].font.color.rgb = MUTED


def add_chart_line_milestones(prs: Presentation) -> None:
    """Revenus projetés — millions FCFA (hypothèses internes)."""
    slide = slide_blank(prs)
    yb = title_block(
        slide,
        "Trajectoire des revenus (hypothèses internes)",
        f"Source : {SRC}",
    )
    chart_data = CategoryChartData()
    chart_data.categories = ["Q3 2026", "2027", "2030"]
    chart_data.add_series("Millions FCFA", (P["q3_2026_rev_m"], P["2027_rev_m"], P["rev_2030_m"]))
    slide.shapes.add_chart(
        XL_CHART_TYPE.LINE_MARKERS,
        Inches(0.85),
        Inches(yb + 0.05),
        Inches(8.3),
        Inches(4.2),
        chart_data,
    )
    note = slide.shapes.add_textbox(TABLE_LEFT, Inches(6.45), TABLE_W, Inches(0.85))
    t = (
        f"2030 = {P['rev_2030_billions']} milliards FCFA = {P['rev_2030_m']} M FCFA · "
        f"2027 = {P['2027_rev_m']} M FCFA (doc.) · Q3 2026 traction : {P['q3_2026_actifs']:,} actifs, {P['q3_2026_rev_m']} M FCFA."
    )
    note.text_frame.paragraphs[0].text = t.replace(",", " ")
    note.text_frame.paragraphs[0].font.size = Pt(9.5)
    note.text_frame.paragraphs[0].font.color.rgb = MUTED
    footer(slide)
    add_logo_br(slide)


def add_table_milestones(prs: Presentation) -> None:
    slide = slide_blank(prs)
    yb = title_block(slide, "Jalons seed (document interne)", None)
    rows = [
        ("Utilisateurs actifs (cible)", "Q1–Q2 2026", f"{P['users_target_k']} K"),
        ("Commerçants actifs (cible)", "Q1–Q2 2026", f"{P['merchants_target_k']} K"),
        ("Traction Q3 2026", "—", f"{P['q3_2026_actifs']:,} actifs · {P['q3_2026_rev_m']} M FCFA".replace(",", " ")),
        ("2027", "—", f"{P['2027_actifs']:,} actifs · {P['2027_rev_m']} M FCFA".replace(",", " ")),
        ("Rentabilité nette +", "2028", f"{P['2028_net_m']} M FCFA (résultat net doc.)"),
    ]
    nrows = len(rows) + 1
    ncol = 3
    top = Inches(yb + 0.1)
    tw = float(TABLE_W)
    cw = (tw / ncol,)
    widths = (Inches(3.2), Inches(2.2), Inches(3.15))
    shape = slide.shapes.add_table(nrows, ncol, TABLE_LEFT, top, TABLE_W, Inches(0.55 * nrows))
    table = shape.table
    for j, w in enumerate(widths):
        table.columns[j].width = w
    hdr = ("Objectif", "Période", "Indicateur clé")
    for j, h in enumerate(hdr):
        c = table.cell(0, j)
        c.text = ""
        p = c.text_frame.paragraphs[0]
        p.text = h
        p.font.bold = True
        p.font.size = Pt(11)
        p.font.color.rgb = WHITE
        c.fill.solid()
        c.fill.fore_color.rgb = NAVY
    for i, row in enumerate(rows, start=1):
        for j, val in enumerate(row):
            c = table.cell(i, j)
            c.text = ""
            c.text_frame.paragraphs[0].text = val
            c.text_frame.paragraphs[0].font.size = Pt(10.5)
            if i % 2 == 0:
                c.fill.solid()
                c.fill.fore_color.rgb = RGBColor(0xF0, 0xF3, 0xFA)
    footer(slide)
    add_logo_br(slide)


def add_product_grid(prs: Presentation) -> None:
    slide = slide_blank(prs)
    title_block(slide, "Modules produit (socle technique existant)", "Une app — plusieurs verticaux")
    lines = [
        "Livraison intelligente (matching, ETA, temps réel)",
        "Fiches produits / digitalisation rapide",
        "Navigation intelligente (NavigationScreen)",
        "Covoiturage · Taxi / VTC",
        "Billets bus & agences de voyage",
        "Bourse du livre scolaire",
        "Immobilier & meublé",
        "Orientation & établissements scolaires",
    ]
    box = slide.shapes.add_textbox(TABLE_LEFT, Inches(1.55), TABLE_W, Inches(5.2))
    tf = box.text_frame
    for k, line in enumerate(lines):
        p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
        p.text = "▸  " + line
        p.font.size = Pt(14)
        p.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
        p.space_after = Pt(11)
    footer(slide)
    add_logo_br(slide)


def main() -> None:
    global _LOGO_PATH
    _LOGO_PATH = resolve_logo_path()

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    # 1 — Couverture impact
    s = slide_blank(prs)
    title_block(s, "Yukpo", f"Seed visé : {P['seed_m']} M FCFA  (~{P['seed_eur_m']} M € / ~{P['seed_usd_m']} M $)")
    add_two_kpi_wide(
        s,
        1.85,
        (f"{P['invisible_pct']}", "Commerces invisibles en ligne", "Problème — doc."),
        (f"{P['seed_m']} M FCFA", "Levée de fonds cible", "Budget marketing + ops — doc."),
    )
    auth = s.shapes.add_textbox(Inches(1), Inches(5.15), Inches(8), Inches(1.1))
    t = auth.text_frame
    t.paragraphs[0].text = "Hernandez LELE — CEO, Yukpo Company"
    t.paragraphs[0].font.size = Pt(12)
    t.paragraphs[0].font.bold = True
    t.paragraphs[0].font.color.rgb = NAVY
    t.paragraphs[0].alignment = PP_ALIGN.CENTER
    p2 = t.add_paragraph()
    p2.text = "Chiffres : " + SRC
    p2.font.size = Pt(9)
    p2.font.color.rgb = MUTED
    p2.alignment = PP_ALIGN.CENTER
    footer(s)
    add_logo_br(s)

    # 2 — Problème
    s = slide_blank(prs)
    yt = title_block(s, "Le problème", "Pourquoi investir maintenant")
    add_kpi_row(
        s,
        yt + 0.05,
        [
            (P["invisible_pct"], "Commerces peu visibles", "Part du informel — doc."),
            (P["cout_site_fcfa"], "Coût création web classique", "FCFA — doc."),
            (P["apps_count"], "Apps pour le quotidien", "Familles — doc."),
        ],
    )
    footer(s)
    add_logo_br(s)

    # 3 — Solution
    s = slide_blank(prs)
    yt = title_block(s, "La réponse Yukpo", "Une super-app locale")
    add_kpi_row(
        s,
        yt + 0.05,
        [
            (f"{P['creation_min']} min", "Création de présence", "Gratuit — doc."),
            (P["population_pct"], "Population cible", "Services essentiels 1 app — doc."),
            (P["livraison_reduction"], "Réduction coût livraison", "Optimisation IA — doc."),
        ],
    )
    footer(s)
    add_logo_br(s)

    # 4 — Marché TAM / SAM
    s = slide_blank(prs)
    add_chart_column(
        s,
        "Marché (milliards FCFA)",
        ["TAM", f"SAM ({P['sam_low']}–{P['sam_high']})"],
        "Milliards FCFA",
        [P["tam_billions"], P["sam_mid"]],
        "SAM : fourchette doc. · point médian affiché pour le graphique",
        "SAM = marché digitalisable (réf. Banque Mondiale 2023, cité dans le one-pager).",
    )
    footer(s)
    add_logo_br(s)

    # 5 — Économie unitaire
    s = slide_blank(prs)
    yt = title_block(s, "Économie unitaire (indicateurs doc.)", None)
    add_kpi_row(
        s,
        yt + 0.05,
        [
            (P["ltv_cac"], "LTV / CAC", "Doc."),
            (f"{P['payback_mois']} mois", "Payback", "Doc."),
            (P["roi_5y"], "ROI 5 ans", "Doc."),
        ],
        foot=f"CAC commerçants {P['cac_marchand_low']}–{P['cac_marchand_high']} K FCFA · utilisateurs {P['cac_user_low']}–{P['cac_user_high']} K · LTV {P['ltv_k']} K FCFA — doc.",
    )
    footer(s)
    add_logo_br(s)

    # 6 — Revenus 2027 vs 2030 (barres, même unité : milliards FCFA)
    s = slide_blank(prs)
    add_chart_column(
        s,
        "Revenus projetés (doc.)",
        ["2027", "2030"],
        "Milliards FCFA",
        [P["rev_2027_m"] / 1000.0, P["rev_2030_billions"]],
        "Une échelle pour comparer les ordres de grandeur",
        "2027 = 897 M FCFA = 0,897 milliard · 2030 = 14,6 milliards FCFA — one-pager.",
    )
    footer(s)
    add_logo_br(s)

    # 7 — Trajectoire ligne
    add_chart_line_milestones(prs)

    # 8 — Levée
    s = slide_blank(prs)
    yt = title_block(s, "La levée", f"{P['seed_m']} M FCFA — répartition doc.")
    add_kpi_row(
        s,
        yt + 0.05,
        [
            (f"{P['pct_marketing']}%", f"{P['m_marketing']} M FCFA", "Marketing & acquisition"),
            (f"{P['pct_ops']}%", f"{P['m_ops']} M FCFA", "Opérations & équipe"),
            (f"{P['seed_m']} M", "Total levée", f"{P['gap_treso']} M trésorerie + {P['reserve']} M réserve — doc."),
        ],
        foot="Justification trésorerie : gap 640 M + réserve 80 M = 720 M — doc.",
    )
    footer(s)
    add_logo_br(s)

    # 9 — Graphique colonnes 220 vs 500
    s = slide_blank(prs)
    add_chart_column(
        s,
        "Utilisation des fonds (M FCFA)",
        ["Marketing & acquisition", "Opérations & équipe"],
        "Millions FCFA",
        [float(P["m_marketing"]), float(P["m_ops"])],
        None,
        "Montants exacts issus du one-pager.",
    )
    footer(s)
    add_logo_br(s)

    # 10 — Jalons tableau
    add_table_milestones(prs)

    # 11 — Produits
    add_product_grid(prs)

    # 12 — Tech
    s = slide_blank(prs)
    title_block(s, "Technologie", "Déjà opérationnelle côté produit")
    bx = s.shapes.add_textbox(TABLE_LEFT, Inches(1.45), TABLE_W, Inches(5))
    for k, line in enumerate(
        [
            "Backend Rust / Axum — API & temps réel",
            "Mobile React Native — modules livraison, transport, billetterie, etc.",
            "IA multi-modèles + recherche sémantique (stack doc. interne)",
        ]
    ):
        p = bx.text_frame.paragraphs[0] if k == 0 else bx.text_frame.add_paragraph()
        p.text = line
        p.font.size = Pt(15)
        p.space_after = Pt(14)
    footer(s)
    add_logo_br(s)

    # 13 — Équipe
    s = slide_blank(prs)
    title_block(s, "Équipe & recrutement post-levée", None)
    bx = s.shapes.add_textbox(TABLE_LEFT, Inches(1.4), TABLE_W, Inches(4.8))
    t = bx.text_frame
    t.paragraphs[0].text = f"Hernandez LELE — fondateur & CEO ({P['founder_exp_y']} ans d’expérience — doc.)"
    t.paragraphs[0].font.size = Pt(14)
    t.paragraphs[0].font.bold = True
    p2 = t.add_paragraph()
    p2.text = "BAD / UNICEF — références doc."
    p2.font.size = Pt(12)
    p3 = t.add_paragraph()
    p3.text = "Recrutement prévu avec financement : CTO, CMO, équipe commerciale — doc."
    p3.font.size = Pt(12)
    p3.space_before = Pt(16)
    footer(s)
    add_logo_br(s)

    # 14 — Géographie
    s = slide_blank(prs)
    title_block(s, "Zone", "Cameroun → extension Afrique francophone — doc.")
    bx = s.shapes.add_textbox(TABLE_LEFT, Inches(2.2), TABLE_W, Inches(2))
    bx.text_frame.paragraphs[0].text = "Pays d’origine : Cameroun"
    bx.text_frame.paragraphs[0].font.size = Pt(20)
    bx.text_frame.paragraphs[0].font.bold = True
    bx.text_frame.paragraphs[0].font.color.rgb = NAVY
    footer(s)
    add_logo_br(s)

    # 15 — Financement options (sans montants inventés)
    s = slide_blank(prs)
    title_block(s, "Options côté investisseur", "À structurer juridiquement")
    opts = [
        "Equity — ticket et valorisation : discussion + data room",
        "Convertible / SAFE / ASA — selon droit applicable",
        "Dette ou quasi-fonds propres — en complément possible",
        "Co-investissement stratégique — distribution / télécom / retail",
    ]
    bx = s.shapes.add_textbox(TABLE_LEFT, Inches(1.5), TABLE_W, Inches(5))
    for k, o in enumerate(opts):
        p = bx.text_frame.paragraphs[0] if k == 0 else bx.text_frame.add_paragraph()
        p.text = "•  " + o
        p.font.size = Pt(14)
        p.space_after = Pt(12)
    footer(s)
    add_logo_br(s)

    # 16 — Contact
    s = slide_blank(prs)
    title_block(s, "Contact", None)
    bx = s.shapes.add_textbox(TABLE_LEFT, Inches(2.4), TABLE_W, Inches(3))
    lines = [
        "Hernandez LELE",
        "lelehernandez2007@yahoo.fr",
        "+237 674 546 895",
        "yukpomnang.com",
    ]
    for k, line in enumerate(lines):
        p = bx.text_frame.paragraphs[0] if k == 0 else bx.text_frame.add_paragraph()
        p.text = line
        p.font.size = Pt(16 if k == 0 else 14)
        p.font.bold = k == 0
        p.font.color.rgb = NAVY if k == 0 else RGBColor(0x33, 0x33, 0x33)
        p.space_after = Pt(10)
    footer(s, "NDA recommandé avant data room complète")
    add_logo_br(s)

    stamp(prs)
    out = Path(__file__).resolve().parent.parent / "Yukpo_Investisseur_Presentation.pptx"
    prs.save(out)
    print(f"Fichier créé : {out}")


if __name__ == "__main__":
    main()
