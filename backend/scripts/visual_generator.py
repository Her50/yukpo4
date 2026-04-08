#!/usr/bin/env python3
"""
visual_generator.py — Génère des visuels marketing (PNG/JPEG) depuis un spec JSON.

Entrée  : spec JSON lu depuis stdin
Sortie  : octets PNG ou JPEG écrits sur stdout

Types supportés :
  poster / flyer, invitation, banner / banner_wide,
  social_post, certificate / attestation,
  business_card / carte_visite, ticket / billet

Thèmes : blue, green, purple, orange, dark, light, gold, elegant, red, corporate
"""

import json
import sys
import io
import base64
import math
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Palette de couleurs par thème
# ---------------------------------------------------------------------------
THEMES = {
    "blue": {
        "bg_top": (15, 52, 96),
        "bg_bottom": (21, 101, 192),
        "accent": (100, 181, 246),
        "card_bg": (255, 255, 255),
        "card_alpha": 230,
        "text_title": (255, 255, 255),
        "text_body": (30, 30, 50),
        "text_accent": (15, 52, 96),
        "badge_bg": (100, 181, 246),
        "badge_text": (255, 255, 255),
        "divider": (100, 181, 246),
    },
    "green": {
        "bg_top": (27, 94, 32),
        "bg_bottom": (56, 142, 60),
        "accent": (129, 199, 132),
        "card_bg": (255, 255, 255),
        "card_alpha": 230,
        "text_title": (255, 255, 255),
        "text_body": (27, 50, 27),
        "text_accent": (27, 94, 32),
        "badge_bg": (129, 199, 132),
        "badge_text": (255, 255, 255),
        "divider": (129, 199, 132),
    },
    "purple": {
        "bg_top": (49, 27, 146),
        "bg_bottom": (123, 31, 162),
        "accent": (206, 147, 216),
        "card_bg": (255, 255, 255),
        "card_alpha": 230,
        "text_title": (255, 255, 255),
        "text_body": (30, 20, 50),
        "text_accent": (123, 31, 162),
        "badge_bg": (206, 147, 216),
        "badge_text": (255, 255, 255),
        "divider": (206, 147, 216),
    },
    "orange": {
        "bg_top": (230, 81, 0),
        "bg_bottom": (255, 160, 0),
        "accent": (255, 224, 130),
        "card_bg": (255, 255, 255),
        "card_alpha": 230,
        "text_title": (255, 255, 255),
        "text_body": (50, 30, 10),
        "text_accent": (230, 81, 0),
        "badge_bg": (255, 224, 130),
        "badge_text": (80, 40, 0),
        "divider": (255, 160, 0),
    },
    "dark": {
        "bg_top": (18, 18, 18),
        "bg_bottom": (38, 38, 58),
        "accent": (0, 229, 255),
        "card_bg": (45, 45, 65),
        "card_alpha": 245,
        "text_title": (255, 255, 255),
        "text_body": (220, 220, 230),
        "text_accent": (0, 229, 255),
        "badge_bg": (0, 229, 255),
        "badge_text": (18, 18, 18),
        "divider": (0, 229, 255),
    },
    "light": {
        "bg_top": (245, 245, 250),
        "bg_bottom": (224, 224, 240),
        "accent": (90, 90, 180),
        "card_bg": (255, 255, 255),
        "card_alpha": 240,
        "text_title": (40, 40, 80),
        "text_body": (60, 60, 80),
        "text_accent": (90, 90, 180),
        "badge_bg": (90, 90, 180),
        "badge_text": (255, 255, 255),
        "divider": (180, 180, 210),
    },
    "gold": {
        "bg_top": (30, 20, 5),
        "bg_bottom": (80, 55, 10),
        "accent": (212, 175, 55),
        "card_bg": (245, 235, 195),
        "card_alpha": 240,
        "text_title": (212, 175, 55),
        "text_body": (40, 30, 5),
        "text_accent": (150, 110, 20),
        "badge_bg": (212, 175, 55),
        "badge_text": (30, 20, 5),
        "divider": (212, 175, 55),
    },
    "elegant": {
        "bg_top": (20, 20, 30),
        "bg_bottom": (50, 40, 60),
        "accent": (200, 170, 130),
        "card_bg": (245, 240, 235),
        "card_alpha": 240,
        "text_title": (200, 170, 130),
        "text_body": (40, 35, 30),
        "text_accent": (150, 120, 80),
        "badge_bg": (200, 170, 130),
        "badge_text": (20, 20, 30),
        "divider": (200, 170, 130),
    },
    "red": {
        "bg_top": (183, 28, 28),
        "bg_bottom": (229, 57, 53),
        "accent": (255, 171, 145),
        "card_bg": (255, 255, 255),
        "card_alpha": 230,
        "text_title": (255, 255, 255),
        "text_body": (50, 10, 10),
        "text_accent": (183, 28, 28),
        "badge_bg": (255, 171, 145),
        "badge_text": (100, 0, 0),
        "divider": (255, 171, 145),
    },
    "corporate": {
        "bg_top": (33, 33, 55),
        "bg_bottom": (55, 55, 85),
        "accent": (144, 202, 249),
        "card_bg": (255, 255, 255),
        "card_alpha": 235,
        "text_title": (255, 255, 255),
        "text_body": (30, 30, 50),
        "text_accent": (33, 33, 55),
        "badge_bg": (144, 202, 249),
        "badge_text": (20, 20, 40),
        "divider": (144, 202, 249),
    },
}

# ---------------------------------------------------------------------------
# Dimensions par format
# ---------------------------------------------------------------------------
FORMAT_SIZES = {
    "square": (1080, 1080),
    "portrait": (1080, 1350),
    "story": (1080, 1920),
    "landscape": (1200, 630),
    "banner_wide": (1500, 500),
    "business_card": (1050, 600),
    "ticket": (1400, 650),
}

# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def get_theme(name: str) -> dict:
    return THEMES.get(name, THEMES["blue"])


def get_size(fmt: str, visual_type: str) -> tuple:
    mapping = {
        "poster": "portrait",
        "flyer": "portrait",
        "invitation": "portrait",
        "banner": "landscape",
        "banner_wide": "banner_wide",
        "social_post": "square",
        "certificate": "landscape",
        "attestation": "landscape",
        "business_card": "business_card",
        "carte_visite": "business_card",
        "ticket": "ticket",
        "billet": "ticket",
    }
    resolved = fmt if fmt in FORMAT_SIZES else mapping.get(visual_type, "portrait")
    return FORMAT_SIZES.get(resolved, (1080, 1350))


def draw_gradient(draw: ImageDraw.Draw, width: int, height: int, color_top: tuple, color_bottom: tuple):
    """Dessine un dégradé vertical."""
    for y in range(height):
        t = y / height
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * t)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * t)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Charge une police système ou retourne la police par défaut."""
    font_paths = []
    if bold:
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
        ]
    else:
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf",
        ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def text_bbox(draw: ImageDraw.Draw, text: str, font) -> tuple:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_rounded_rect(draw: ImageDraw.Draw, xy: tuple, radius: int, fill: tuple):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2 * radius, y0 + 2 * radius], fill=fill)
    draw.ellipse([x1 - 2 * radius, y0, x1, y0 + 2 * radius], fill=fill)
    draw.ellipse([x0, y1 - 2 * radius, x0 + 2 * radius, y1], fill=fill)
    draw.ellipse([x1 - 2 * radius, y1 - 2 * radius, x1, y1], fill=fill)


def draw_text_wrapped(draw: ImageDraw.Draw, text: str, x: int, y: int, max_width: int,
                       font, color: tuple, line_spacing: int = 8) -> int:
    """Dessine du texte avec retour à la ligne automatique. Retourne le y final."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        w, _ = text_bbox(draw, test, font)
        if w <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    cy = y
    for line in lines:
        draw.text((x, cy), line, font=font, fill=color)
        _, h = text_bbox(draw, line, font)
        cy += h + line_spacing
    return cy


def load_logo(spec: dict) -> Image.Image | None:
    b64 = spec.get("logo_base64")
    if not b64:
        return None
    try:
        raw = base64.b64decode(b64)
        return Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception:
        return None


def paste_logo(img: Image.Image, logo: Image.Image, x: int, y: int, max_w: int, max_h: int):
    logo_copy = logo.copy()
    logo_copy.thumbnail((max_w, max_h), Image.LANCZOS)
    if logo_copy.mode == "RGBA":
        img.paste(logo_copy, (x, y), logo_copy)
    else:
        img.paste(logo_copy, (x, y))


# ---------------------------------------------------------------------------
# Générateurs par type
# ---------------------------------------------------------------------------

def generate_poster(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    description = spec.get("description", "")
    date = spec.get("date", "")
    time_ = spec.get("time", "")
    location = spec.get("location", "")
    organizer = spec.get("organizer", "")
    contact = spec.get("contact", "")
    price = spec.get("price", "")
    badge = spec.get("badge", "")
    bullets = spec.get("bullets", [])
    hashtags = spec.get("hashtags", [])
    brand_name = spec.get("brand_name", "")

    margin = int(w * 0.07)
    inner_w = w - 2 * margin
    y = int(h * 0.05)

    # Badge
    if badge:
        font_badge = load_font(int(w * 0.032), bold=True)
        bw, bh = text_bbox(draw, badge, font_badge)
        pad = int(w * 0.018)
        bx = w - margin - bw - 2 * pad
        by = y
        draw_rounded_rect(draw, (bx, by, bx + bw + 2 * pad, by + bh + 2 * pad), 10, theme["badge_bg"])
        draw.text((bx + pad, by + pad), badge, font=font_badge, fill=theme["badge_text"])
        y += bh + 2 * pad + int(h * 0.02)

    # Brand / organizer name en haut
    if brand_name:
        font_brand = load_font(int(w * 0.038), bold=True)
        draw.text((margin, y), brand_name.upper(), font=font_brand, fill=theme["accent"])
        _, bh = text_bbox(draw, brand_name, font_brand)
        y += bh + int(h * 0.015)

    # Titre principal
    font_title = load_font(int(w * 0.068), bold=True)
    y = draw_text_wrapped(draw, title, margin, y, inner_w, font_title, theme["text_title"], 6)
    y += int(h * 0.015)

    # Ligne décorative
    draw.rectangle([margin, y, margin + inner_w, y + 3], fill=theme["accent"])
    y += int(h * 0.025)

    # Sous-titre
    if subtitle:
        font_sub = load_font(int(w * 0.038))
        y = draw_text_wrapped(draw, subtitle, margin, y, inner_w, font_sub, theme["accent"], 5)
        y += int(h * 0.02)

    # Logo
    logo = load_logo(spec)
    logo_h = 0
    if logo:
        lw = int(w * 0.25)
        lh = int(h * 0.12)
        paste_logo(img, logo, w - margin - lw, y, lw, lh)
        logo_h = lh + int(h * 0.02)

    # Carte info
    card_margin = int(h * 0.04)
    card_top = y + logo_h
    card_bottom = int(h * 0.88)
    card_h = card_bottom - card_top
    if card_h > 80:
        draw = ImageDraw.Draw(img, "RGBA")
        r, g, b = theme["card_bg"]
        draw.rounded_rectangle(
            [margin, card_top, w - margin, card_bottom],
            radius=16,
            fill=(r, g, b, theme["card_alpha"]),
        )
        draw = ImageDraw.Draw(img)

        cy = card_top + card_margin
        font_info = load_font(int(w * 0.032), bold=False)
        font_info_b = load_font(int(w * 0.032), bold=True)
        icon_map = [
            ("📅", date), ("🕐", time_), ("📍", location),
            ("🎫", price), ("📞", contact), ("🏢", organizer),
        ]
        for icon, val in icon_map:
            if val and cy < card_bottom - card_margin - 30:
                line = f"{icon} {val}"
                draw.text((margin + int(w * 0.04), cy), line, font=font_info, fill=theme["text_accent"])
                _, lh2 = text_bbox(draw, line, font_info)
                cy += lh2 + int(h * 0.012)

        # Bullets
        if bullets and cy < card_bottom - card_margin - 30:
            draw.line([(margin + int(w * 0.04), cy), (w - margin - int(w * 0.04), cy)],
                      fill=theme["divider"], width=1)
            cy += int(h * 0.012)
            font_bullet = load_font(int(w * 0.028))
            for b_text in bullets[:4]:
                if cy >= card_bottom - card_margin - 20:
                    break
                line = f"• {b_text}"
                draw.text((margin + int(w * 0.04), cy), line, font=font_bullet, fill=theme["text_body"])
                _, lh2 = text_bbox(draw, line, font_bullet)
                cy += lh2 + int(h * 0.01)

    # Description en dessous de la carte si espace
    if description and card_bottom < int(h * 0.96):
        font_desc = load_font(int(w * 0.026))
        draw_text_wrapped(draw, description, margin, card_bottom + int(h * 0.015),
                          inner_w, font_desc, theme["text_title"], 5)

    # Hashtags en bas
    if hashtags:
        font_hash = load_font(int(w * 0.025))
        hash_text = "  ".join(f"#{tag}" for tag in hashtags[:5])
        hy = int(h * 0.93)
        draw.text((margin, hy), hash_text, font=font_hash, fill=theme["accent"])

    return img


def generate_invitation(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    # Cadre orné extérieur
    border = int(w * 0.04)
    draw.rectangle([border, border, w - border, h - border],
                   outline=theme["accent"], width=3)
    inner_border = border + int(w * 0.015)
    draw.rectangle([inner_border, inner_border, w - inner_border, h - inner_border],
                   outline=theme["accent"], width=1)

    # Ornements coins
    corner = int(w * 0.06)
    corners = [
        (border, border), (w - border - corner, border),
        (border, h - border - corner), (w - border - corner, h - border - corner)
    ]
    for cx, cy in corners:
        draw.ellipse([cx, cy, cx + corner, cy + corner], outline=theme["accent"], width=2)

    margin = int(w * 0.12)
    inner_w = w - 2 * margin
    y = int(h * 0.10)

    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    description = spec.get("description", "")
    date = spec.get("date", "")
    time_ = spec.get("time", "")
    location = spec.get("location", "")
    organizer = spec.get("organizer", "")
    contact = spec.get("contact", "")
    price = spec.get("price", "")
    badge = spec.get("badge", "")
    bullets = spec.get("bullets", [])
    brand_name = spec.get("brand_name", "")

    # "VOUS ÊTES CORDIALEMENT INVITÉ(E)"
    font_invite = load_font(int(w * 0.028))
    invite_text = "VOUS ÊTES CORDIALEMENT INVITÉ(E)"
    tw, _ = text_bbox(draw, invite_text, font_invite)
    draw.text(((w - tw) // 2, y), invite_text, font=font_invite, fill=theme["accent"])
    y += int(h * 0.045)

    # Ligne déco
    line_pad = int(w * 0.15)
    draw.line([(line_pad, y), (w - line_pad, y)], fill=theme["accent"], width=2)
    y += int(h * 0.025)

    # Titre
    font_title = load_font(int(w * 0.065), bold=True)
    lines_used = []
    words = title.split()
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        tw2, _ = text_bbox(draw, test, font_title)
        if tw2 <= inner_w:
            current = test
        else:
            if current:
                lines_used.append(current)
            current = word
    if current:
        lines_used.append(current)
    for line in lines_used:
        tw3, th3 = text_bbox(draw, line, font_title)
        draw.text(((w - tw3) // 2, y), line, font=font_title, fill=theme["text_title"])
        y += th3 + 6

    y += int(h * 0.015)
    draw.line([(line_pad, y), (w - line_pad, y)], fill=theme["accent"], width=2)
    y += int(h * 0.025)

    # Subtitle
    if subtitle:
        font_sub = load_font(int(w * 0.033))
        tw4, th4 = text_bbox(draw, subtitle, font_sub)
        x_sub = max(margin, (w - tw4) // 2)
        draw_text_wrapped(draw, subtitle, x_sub, y, inner_w, font_sub, theme["accent"], 5)
        y += th4 + int(h * 0.025)

    # Logo centré
    logo = load_logo(spec)
    if logo:
        lw = int(w * 0.20)
        lh = int(h * 0.10)
        lx = (w - lw) // 2
        paste_logo(img, logo, lx, y, lw, lh)
        y += lh + int(h * 0.02)

    # Informations
    font_info = load_font(int(w * 0.030))
    info_items = [
        ("📅", date), ("🕐", time_), ("📍", location),
        ("💰", price), ("📞", contact), ("🏢", organizer),
    ]
    for icon, val in info_items:
        if val and y < int(h * 0.82):
            line = f"{icon}  {val}"
            tw5, th5 = text_bbox(draw, line, font_info)
            draw.text(((w - tw5) // 2, y), line, font=font_info, fill=theme["text_title"])
            y += th5 + int(h * 0.012)

    # Bullets
    if bullets and y < int(h * 0.85):
        y += int(h * 0.01)
        font_bullet = load_font(int(w * 0.026))
        for b_text in bullets[:3]:
            if y >= int(h * 0.87):
                break
            line = f"✦  {b_text}"
            tw6, th6 = text_bbox(draw, line, font_bullet)
            draw.text(((w - tw6) // 2, y), line, font=font_bullet, fill=theme["accent"])
            y += th6 + int(h * 0.01)

    # Badge
    if badge:
        font_badge = load_font(int(w * 0.035), bold=True)
        bw, bh = text_bbox(draw, badge, font_badge)
        pad = int(w * 0.025)
        bx = (w - bw - 2 * pad) // 2
        by = int(h * 0.88)
        draw_rounded_rect(draw, (bx, by, bx + bw + 2 * pad, by + bh + 2 * pad), 12, theme["badge_bg"])
        draw.text((bx + pad, by + pad), badge, font=font_badge, fill=theme["badge_text"])

    return img


def generate_banner(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    # Bande décorative gauche
    band_w = int(w * 0.008)
    draw.rectangle([0, 0, band_w, h], fill=theme["accent"])

    margin_x = int(w * 0.06)
    margin_y = int(h * 0.12)
    content_w = w - 2 * margin_x

    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    description = spec.get("description", "")
    badge = spec.get("badge", "")
    brand_name = spec.get("brand_name", "")
    contact = spec.get("contact", "")
    date = spec.get("date", "")

    logo = load_logo(spec)
    text_max_w = content_w - (int(w * 0.25) if logo else 0)

    y = margin_y

    if brand_name:
        font_brand = load_font(int(h * 0.12), bold=True)
        draw.text((margin_x, y), brand_name.upper(), font=font_brand, fill=theme["accent"])
        _, bh = text_bbox(draw, brand_name, font_brand)
        y += bh + int(h * 0.05)

    font_title = load_font(int(h * 0.22), bold=True)
    y = draw_text_wrapped(draw, title, margin_x, y, text_max_w, font_title, theme["text_title"], 4)
    y += int(h * 0.04)

    if subtitle:
        font_sub = load_font(int(h * 0.14))
        y = draw_text_wrapped(draw, subtitle, margin_x, y, text_max_w, font_sub, theme["accent"], 4)
        y += int(h * 0.04)

    if description:
        font_desc = load_font(int(h * 0.11))
        draw_text_wrapped(draw, description, margin_x, y, text_max_w, font_desc, theme["text_title"], 4)

    # Infos date/contact à droite
    info_x = w - margin_x - int(w * 0.22)
    info_y = margin_y
    font_info = load_font(int(h * 0.12))
    for val in [date, contact]:
        if val:
            tw, th = text_bbox(draw, val, font_info)
            draw.text((w - margin_x - tw, info_y), val, font=font_info, fill=theme["accent"])
            info_y += th + int(h * 0.06)

    # Badge
    if badge:
        font_badge = load_font(int(h * 0.14), bold=True)
        bw, bh = text_bbox(draw, badge, font_badge)
        pad = int(h * 0.08)
        bx = w - margin_x - bw - 2 * pad
        by = h - margin_y - bh - 2 * pad
        draw_rounded_rect(draw, (bx, by, bx + bw + 2 * pad, by + bh + 2 * pad), 8, theme["badge_bg"])
        draw.text((bx + pad, by + pad), badge, font=font_badge, fill=theme["badge_text"])

    # Logo
    if logo:
        lw = int(w * 0.18)
        lh = int(h * 0.65)
        lx = w - margin_x - lw
        ly = (h - min(lh, int(h * 0.7))) // 2
        paste_logo(img, logo, lx, ly, lw, lh)

    return img


def generate_social_post(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    """Post Instagram/Facebook/LinkedIn."""
    return generate_poster(spec, theme, w, h)


def generate_certificate(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    # Double cadre
    b1 = int(min(w, h) * 0.03)
    b2 = b1 + int(min(w, h) * 0.012)
    draw.rectangle([b1, b1, w - b1, h - b1], outline=theme["accent"], width=4)
    draw.rectangle([b2, b2, w - b2, h - b2], outline=theme["accent"], width=2)

    # Ornements coins
    corner = int(min(w, h) * 0.06)
    for cx, cy in [(b1, b1), (w - b1 - corner, b1), (b1, h - b1 - corner), (w - b1 - corner, h - b1 - corner)]:
        draw.ellipse([cx, cy, cx + corner, cy + corner], outline=theme["accent"], width=2)

    margin = int(w * 0.10)
    inner_w = w - 2 * margin
    cy_pos = int(h * 0.10)

    title = spec.get("title", "CERTIFICAT")
    subtitle = spec.get("subtitle", "")
    description = spec.get("description", "")
    organizer = spec.get("organizer", "")
    date = spec.get("date", "")
    badge = spec.get("badge", "")
    contact = spec.get("contact", "")
    brand_name = spec.get("brand_name", "")

    font_cert = load_font(int(h * 0.06), bold=True)
    tw, th = text_bbox(draw, title.upper(), font_cert)
    draw.text(((w - tw) // 2, cy_pos), title.upper(), font=font_cert, fill=theme["text_title"])
    cy_pos += th + int(h * 0.03)

    draw.line([(margin, cy_pos), (w - margin, cy_pos)], fill=theme["accent"], width=2)
    cy_pos += int(h * 0.03)

    if subtitle:
        font_sub = load_font(int(h * 0.04))
        tw2, th2 = text_bbox(draw, subtitle, font_sub)
        draw.text(((w - tw2) // 2, cy_pos), subtitle, font=font_sub, fill=theme["accent"])
        cy_pos += th2 + int(h * 0.04)

    if badge:
        font_badge = load_font(int(h * 0.045), bold=True)
        tw3, th3 = text_bbox(draw, badge, font_badge)
        pad = int(h * 0.02)
        bx = (w - tw3 - 2 * pad) // 2
        draw_rounded_rect(draw, (bx, cy_pos, bx + tw3 + 2 * pad, cy_pos + th3 + 2 * pad), 8, theme["badge_bg"])
        draw.text((bx + pad, cy_pos + pad), badge, font=font_badge, fill=theme["badge_text"])
        cy_pos += th3 + 2 * pad + int(h * 0.04)

    if description:
        font_desc = load_font(int(h * 0.035))
        cy_pos = draw_text_wrapped(draw, description, margin, cy_pos, inner_w, font_desc, theme["text_title"], 6)
        cy_pos += int(h * 0.03)

    # Logo centré
    logo = load_logo(spec)
    if logo:
        lw = int(w * 0.15)
        lh = int(h * 0.18)
        lx = (w - lw) // 2
        paste_logo(img, logo, lx, cy_pos, lw, lh)
        cy_pos += lh + int(h * 0.04)

    # Infos bas
    font_info = load_font(int(h * 0.032))
    bottom_y = int(h * 0.78)
    draw.line([(margin, bottom_y), (w - margin, bottom_y)], fill=theme["accent"], width=1)
    bottom_y += int(h * 0.02)
    for val in [organizer, date, contact]:
        if val:
            tw4, th4 = text_bbox(draw, val, font_info)
            draw.text(((w - tw4) // 2, bottom_y), val, font=font_info, fill=theme["accent"])
            bottom_y += th4 + int(h * 0.015)

    if brand_name:
        font_brand = load_font(int(h * 0.028), bold=True)
        tw5, _ = text_bbox(draw, brand_name, font_brand)
        draw.text(((w - tw5) // 2, int(h * 0.92)), brand_name.upper(), font=font_brand, fill=theme["accent"])

    return img


def generate_business_card(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    # Bande décorative gauche
    band = int(w * 0.012)
    draw.rectangle([0, 0, band, h], fill=theme["accent"])

    # Bande décorative bas
    draw.rectangle([0, h - band, w, h], fill=theme["accent"])

    margin = int(w * 0.07)
    inner_w = w - 2 * margin

    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    description = spec.get("description", spec.get("organizer", ""))
    contact = spec.get("contact", "")
    location = spec.get("location", "")
    brand_name = spec.get("brand_name", title)
    badge = spec.get("badge", "")

    # Logo à droite
    logo = load_logo(spec)
    if logo:
        lw = int(w * 0.22)
        lh = int(h * 0.55)
        paste_logo(img, logo, w - margin - lw, (h - lh) // 2, lw, lh)

    y = int(h * 0.18)

    if brand_name:
        font_brand = load_font(int(h * 0.20), bold=True)
        draw.text((margin, y), brand_name, font=font_brand, fill=theme["text_title"])
        _, bh = text_bbox(draw, brand_name, font_brand)
        y += bh + int(h * 0.04)

    if subtitle:
        font_sub = load_font(int(h * 0.13))
        draw.text((margin, y), subtitle, font=font_sub, fill=theme["accent"])
        _, sh = text_bbox(draw, subtitle, font_sub)
        y += sh + int(h * 0.06)

    draw.line([(margin, y), (int(w * 0.55), y)], fill=theme["accent"], width=2)
    y += int(h * 0.08)

    font_info = load_font(int(h * 0.11))
    for val in [description, contact, location]:
        if val and y < int(h * 0.85):
            draw.text((margin, y), val, font=font_info, fill=theme["text_title"])
            _, ih = text_bbox(draw, val, font_info)
            y += ih + int(h * 0.06)

    return img


def generate_ticket(spec: dict, theme: dict, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, w, h, theme["bg_top"], theme["bg_bottom"])

    # Souche décorative à droite (25% de la largeur)
    stub_x = int(w * 0.75)
    draw.rectangle([stub_x, 0, w, h], fill=tuple(max(0, c - 20) for c in theme["bg_bottom"]))

    # Ligne pointillée entre main et souche
    dot_x = stub_x
    for dy in range(0, h, 16):
        draw.ellipse([dot_x - 3, dy, dot_x + 3, dy + 6], fill=theme["accent"])

    # Demi-cercles sur les bords
    r_notch = int(h * 0.06)
    draw.ellipse([stub_x - r_notch, -r_notch, stub_x + r_notch, r_notch], fill=theme["bg_bottom"])
    draw.ellipse([stub_x - r_notch, h - r_notch, stub_x + r_notch, h + r_notch], fill=theme["bg_bottom"])

    margin = int(w * 0.04)
    main_w = stub_x - 2 * margin
    y = int(h * 0.10)

    title = spec.get("title", "")
    subtitle = spec.get("subtitle", "")
    date = spec.get("date", "")
    time_ = spec.get("time", "")
    location = spec.get("location", "")
    price = spec.get("price", "")
    contact = spec.get("contact", "")  # numéro de billet
    organizer = spec.get("organizer", "")
    badge = spec.get("badge", "")
    brand_name = spec.get("brand_name", "")

    # Badge type (ENTRÉE, VIP, etc.)
    if badge:
        font_badge = load_font(int(h * 0.14), bold=True)
        bw, bh = text_bbox(draw, badge, font_badge)
        pad = int(h * 0.05)
        draw_rounded_rect(draw, (margin, y, margin + bw + 2 * pad, y + bh + 2 * pad), 8, theme["badge_bg"])
        draw.text((margin + pad, y + pad), badge, font=font_badge, fill=theme["badge_text"])
        y += bh + 2 * pad + int(h * 0.04)

    # Titre
    font_title = load_font(int(h * 0.20), bold=True)
    y = draw_text_wrapped(draw, title, margin, y, main_w, font_title, theme["text_title"], 4)
    y += int(h * 0.03)

    draw.line([(margin, y), (stub_x - margin, y)], fill=theme["accent"], width=2)
    y += int(h * 0.04)

    if subtitle:
        font_sub = load_font(int(h * 0.13))
        y = draw_text_wrapped(draw, subtitle, margin, y, main_w, font_sub, theme["accent"], 4)
        y += int(h * 0.03)

    # Infos
    font_info = load_font(int(h * 0.12))
    for icon, val in [("📅", date), ("🕐", time_), ("📍", location), ("💰", price)]:
        if val and y < int(h * 0.82):
            line = f"{icon} {val}"
            draw.text((margin, y), line, font=font_info, fill=theme["text_title"])
            _, ih = text_bbox(draw, line, font_info)
            y += ih + int(h * 0.04)

    # Souche à droite
    stub_inner_x = stub_x + int(w * 0.03)
    stub_w = w - stub_inner_x - int(w * 0.03)
    sy = int(h * 0.12)

    font_stub_title = load_font(int(h * 0.10), bold=True)
    draw_text_wrapped(draw, title, stub_inner_x, sy, stub_w, font_stub_title, theme["text_title"], 4)
    sy += int(h * 0.35)

    font_stub = load_font(int(h * 0.09))
    for val in [date, time_, organizer]:
        if val and sy < int(h * 0.85):
            draw_text_wrapped(draw, val, stub_inner_x, sy, stub_w, font_stub, theme["accent"], 4)
            sy += int(h * 0.12)

    # Numéro de billet
    if contact:
        font_num = load_font(int(h * 0.12), bold=True)
        num_y = int(h * 0.80)
        tw, _ = text_bbox(draw, contact, font_num)
        draw.text((stub_inner_x + (stub_w - tw) // 2, num_y), contact, font=font_num, fill=theme["badge_bg"])

    # Logo
    logo = load_logo(spec)
    if logo:
        paste_logo(img, logo, margin, int(h * 0.78), int(w * 0.12), int(h * 0.18))

    return img


# ---------------------------------------------------------------------------
# Dispatcher principal
# ---------------------------------------------------------------------------

def generate_visual(spec: dict) -> bytes:
    visual_type = spec.get("visual_type", "poster").lower()
    fmt = spec.get("format", "").lower()
    theme_name = spec.get("theme", "blue").lower()
    output_format = spec.get("output_format", "png").lower()

    theme = get_theme(theme_name)
    w, h = get_size(fmt, visual_type)

    if visual_type in ("poster", "flyer"):
        img = generate_poster(spec, theme, w, h)
    elif visual_type == "invitation":
        img = generate_invitation(spec, theme, w, h)
    elif visual_type in ("banner", "banner_wide"):
        img = generate_banner(spec, theme, w, h)
    elif visual_type == "social_post":
        img = generate_social_post(spec, theme, w, h)
    elif visual_type in ("certificate", "attestation"):
        img = generate_certificate(spec, theme, w, h)
    elif visual_type in ("business_card", "carte_visite"):
        img = generate_business_card(spec, theme, w, h)
    elif visual_type in ("ticket", "billet"):
        img = generate_ticket(spec, theme, w, h)
    else:
        img = generate_poster(spec, theme, w, h)

    buf = io.BytesIO()
    if output_format in ("jpeg", "jpg"):
        img = img.convert("RGB")
        img.save(buf, format="JPEG", quality=92, optimize=True)
    else:
        img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main():
    raw = sys.stdin.buffer.read()
    try:
        spec = json.loads(raw)
    except Exception as e:
        print(f"[visual_generator] JSON parse error: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        data = generate_visual(spec)
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"[visual_generator] Generation error: {e}", file=sys.stderr)
        sys.exit(1)

    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


if __name__ == "__main__":
    main()
