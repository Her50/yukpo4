#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YukpoIA Visual Generator — v1
Generates high-quality marketing visuals, invitation cards, banners, and social media assets.
Reads a JSON spec from stdin, writes PNG/JPEG bytes to stdout.

Input JSON schema:
{
  "visual_type": "poster" | "invitation" | "banner" | "social_post" | "flyer" | "certificate" | "business_card",
  "format": "square" | "portrait" | "landscape" | "story" | "banner_wide" | "a4",
  "theme": "blue" | "green" | "purple" | "orange" | "dark" | "light" | "gold" | "elegant",
  "output_format": "png" | "jpeg",
  "quality": 90,

  // Content
  "title": "Titre principal",
  "subtitle": "Sous-titre",
  "description": "Description ou corps de texte",
  "date": "Samedi 12 Avril 2026",
  "time": "18h00 – 23h00",
  "location": "Hôtel Ivoire, Abidjan",
  "organizer": "Nom de l'organisateur",
  "contact": "+225 07 00 00 00 00",
  "price": "10 000 FCFA",
  "hashtags": ["#Yukpo", "#Event2026"],
  "bullets": ["Point 1", "Point 2"],
  "badge": "GRATUIT",        // Badge/étiquette (ex: GRATUIT, VIP, NEW)
  "badge_color": "#FF5733",

  // Branding
  "logo_base64": "...",      // Logo base64 (optionnel)
  "logo_mime": "image/png",
  "brand_name": "Yukpo",
  "brand_color": "#003399",

  // Background image (optionnel)
  "bg_image_base64": "...",
  "bg_opacity": 0.35,        // Opacité de l'image de fond (0.0 – 1.0)

  // QR code (optionnel)
  "qr_data": "https://yukpo.com/event/123"
}
"""

from __future__ import annotations
import base64
import io
import json
import math
import os
import sys
import tempfile
import traceback
from typing import Any

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ─── Palettes de thèmes ───────────────────────────────────────────────────────

THEMES: dict[str, dict] = {
    "blue": {
        "bg": (8, 32, 80), "bg2": (0, 70, 160), "accent": (0, 180, 255),
        "text": (255, 255, 255), "subtitle": (180, 210, 255), "card": (20, 50, 100),
        "badge_bg": (255, 180, 0), "badge_text": (20, 20, 20),
        "gradient_top": (0, 50, 140), "gradient_bot": (0, 10, 50),
    },
    "green": {
        "bg": (10, 50, 25), "bg2": (20, 120, 60), "accent": (50, 220, 120),
        "text": (255, 255, 255), "subtitle": (180, 255, 200), "card": (15, 70, 35),
        "badge_bg": (255, 220, 0), "badge_text": (20, 20, 20),
        "gradient_top": (15, 90, 45), "gradient_bot": (5, 20, 10),
    },
    "purple": {
        "bg": (30, 10, 60), "bg2": (100, 20, 180), "accent": (200, 100, 255),
        "text": (255, 255, 255), "subtitle": (210, 175, 255), "card": (50, 20, 90),
        "badge_bg": (255, 180, 50), "badge_text": (20, 20, 20),
        "gradient_top": (80, 20, 150), "gradient_bot": (15, 5, 35),
    },
    "orange": {
        "bg": (60, 20, 0), "bg2": (200, 70, 0), "accent": (255, 160, 0),
        "text": (255, 255, 255), "subtitle": (255, 220, 170), "card": (90, 35, 5),
        "badge_bg": (255, 230, 50), "badge_text": (40, 20, 0),
        "gradient_top": (180, 60, 0), "gradient_bot": (30, 10, 0),
    },
    "dark": {
        "bg": (12, 12, 20), "bg2": (30, 30, 50), "accent": (0, 210, 255),
        "text": (230, 230, 245), "subtitle": (160, 170, 200), "card": (25, 25, 45),
        "badge_bg": (0, 210, 120), "badge_text": (10, 10, 20),
        "gradient_top": (25, 25, 50), "gradient_bot": (5, 5, 15),
    },
    "light": {
        "bg": (245, 247, 255), "bg2": (210, 220, 250), "accent": (45, 90, 200),
        "text": (20, 20, 50), "subtitle": (80, 100, 160), "card": (225, 230, 250),
        "badge_bg": (255, 100, 50), "badge_text": (255, 255, 255),
        "gradient_top": (220, 228, 252), "gradient_bot": (245, 247, 255),
    },
    "gold": {
        "bg": (20, 15, 5), "bg2": (80, 60, 5), "accent": (255, 215, 0),
        "text": (255, 240, 180), "subtitle": (220, 190, 120), "card": (40, 30, 5),
        "badge_bg": (255, 215, 0), "badge_text": (20, 15, 5),
        "gradient_top": (70, 50, 5), "gradient_bot": (10, 8, 2),
    },
    "elegant": {
        "bg": (15, 15, 15), "bg2": (35, 30, 30), "accent": (200, 170, 110),
        "text": (240, 235, 225), "subtitle": (190, 175, 150), "card": (28, 25, 22),
        "badge_bg": (200, 170, 110), "badge_text": (15, 15, 15),
        "gradient_top": (35, 30, 28), "gradient_bot": (8, 7, 7),
    },
}
DEFAULT_THEME = "blue"

# ─── Canvas sizes ─────────────────────────────────────────────────────────────

FORMATS: dict[str, tuple[int, int]] = {
    "square":       (1080, 1080),
    "portrait":     (1080, 1350),
    "landscape":    (1200, 630),
    "story":        (1080, 1920),
    "banner_wide":  (1500, 500),
    "a4":           (2480, 3508),  # 300dpi A4
    "business_card":(1050, 600),
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def decode_b64(b64_str: str) -> bytes | None:
    try:
        d = b64_str.strip()
        if "," in d:
            d = d.split(",", 1)[1]
        return base64.b64decode(d)
    except Exception:
        return None

def load_image_b64(b64_str: str) -> Image.Image | None:
    b = decode_b64(b64_str)
    if not b:
        return None
    try:
        return Image.open(io.BytesIO(b)).convert("RGBA")
    except Exception:
        return None

def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def make_gradient(size: tuple[int, int], top: tuple, bot: tuple, direction="vertical") -> Image.Image:
    w, h = size
    img = Image.new("RGBA", (w, h))
    pixels = img.load()
    for y in range(h):
        for x in range(w):
            if direction == "diagonal":
                t = (x / w + y / h) / 2
            elif direction == "horizontal":
                t = x / w
            else:
                t = y / h
            c = lerp_color(top, bot, t)
            pixels[x, y] = (*c, 255)
    return img

def draw_rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width=2):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Try to load a system font, fallback to default."""
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
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()

def wrap_text(text: str, font, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]

def draw_multiline(draw, text: str, font, x, y, max_w, fill, align="left", line_spacing=1.25) -> int:
    """Draw wrapped text; return the y position after last line."""
    lines = wrap_text(text, font, max_w, draw)
    fh = draw.textbbox((0, 0), "Ag", font=font)[3]
    lh = int(fh * line_spacing)
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2]
        if align == "center":
            lx = x + (max_w - lw) // 2
        elif align == "right":
            lx = x + max_w - lw
        else:
            lx = x
        draw.text((lx, y), line, font=font, fill=fill)
        y += lh
    return y

def add_shadow_text(draw, text, font, x, y, fill, shadow_offset=3, shadow_color=(0, 0, 0, 140)):
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
    draw.text((x, y), text, font=font, fill=fill)

# ─── Poster / Flyer ───────────────────────────────────────────────────────────

def render_poster(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient((W, H), T["gradient_top"], T["gradient_bot"])
    draw = ImageDraw.Draw(img, "RGBA")

    # Background image
    if bg_b64 := data.get("bg_image_base64"):
        bg_img = load_image_b64(bg_b64)
        if bg_img:
            bg_img = bg_img.convert("RGBA").resize((W, H), Image.LANCZOS)
            opacity = int(data.get("bg_opacity", 0.3) * 255)
            mask = Image.new("L", (W, H), opacity)
            img.paste(bg_img, (0, 0), mask)
            draw = ImageDraw.Draw(img, "RGBA")

    pad = int(W * 0.06)
    cw = W - 2 * pad

    # Top decorative bar
    draw.rectangle([0, 0, W, int(H * 0.007)], fill=T["accent"])

    # Logo top-left
    logo_y = pad
    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.08)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            img.paste(logo, (pad, logo_y), logo)

    # Brand name top-right
    if brand := data.get("brand_name"):
        bfont = get_font(int(H * 0.028), bold=True)
        bbox = draw.textbbox((0, 0), brand, font=bfont)
        draw.text((W - pad - bbox[2], pad + 6), brand, font=bfont, fill=T["accent"])

    # Badge
    if badge := data.get("badge"):
        badge_color = T["badge_bg"]
        if badge_hex := data.get("badge_color"):
            try:
                badge_color = hex_to_rgb(badge_hex)
            except Exception:
                pass
        bfont = get_font(int(H * 0.024), bold=True)
        bb = draw.textbbox((0, 0), f"  {badge}  ", font=bfont)
        bw, bh = bb[2] + 20, bb[3] + 14
        bx, by_ = W - pad - bw, int(H * 0.12)
        draw_rounded_rect(draw, (bx, by_, bx + bw, by_ + bh), 8, fill=badge_color)
        draw.text((bx + 10, by_ + 7), badge, font=bfont, fill=T["badge_text"])

    # Main title
    title = data.get("title", "")
    title_y = int(H * 0.22)
    tfont_size = max(int(W * 0.075), 48)
    tfont = get_font(tfont_size, bold=True)
    ty = draw_multiline(draw, title, tfont, pad, title_y, cw,
                         fill=(*T["text"], 255), align="center", line_spacing=1.15)
    # Accent underline
    draw.rectangle([pad + cw // 4, ty + 8, W - pad - cw // 4, ty + 12], fill=T["accent"])
    ty += 24

    # Subtitle
    if subtitle := data.get("subtitle"):
        sfont = get_font(int(W * 0.038))
        ty = draw_multiline(draw, subtitle, sfont, pad, ty + 10, cw,
                             fill=(*T["subtitle"], 230), align="center")
        ty += 8

    # Description
    if desc := data.get("description"):
        dfont = get_font(int(W * 0.028))
        ty = draw_multiline(draw, desc, dfont, pad + int(cw * 0.05), ty + 16,
                             int(cw * 0.9), fill=(*T["text"], 200), align="center")
        ty += 8

    # Info card (date, time, location, price)
    info_items = []
    if d := data.get("date"):   info_items.append(("📅", d))
    if t := data.get("time"):   info_items.append(("🕐", t))
    if l := data.get("location"): info_items.append(("📍", l))
    if p := data.get("price"):  info_items.append(("💰", p))

    if info_items:
        card_pad = int(W * 0.04)
        card_x = pad
        card_w = cw
        card_line_h = int(H * 0.06)
        card_h = len(info_items) * card_line_h + 2 * card_pad
        card_y_start = ty + 20
        # Card background
        draw.rounded_rectangle(
            [card_x, card_y_start, card_x + card_w, card_y_start + card_h],
            radius=16, fill=(*T["card"], 200)
        )
        # Accent left bar
        draw.rounded_rectangle(
            [card_x, card_y_start, card_x + 6, card_y_start + card_h],
            radius=4, fill=(*T["accent"], 255)
        )
        ifont = get_font(int(H * 0.028))
        for i, (ico, text) in enumerate(info_items):
            item_y = card_y_start + card_pad + i * card_line_h
            draw.text((card_x + 22, item_y), ico + "  " + text, font=ifont,
                       fill=(*T["text"], 240))
        ty = card_y_start + card_h + 10

    # Bullets
    for bullet in data.get("bullets", []):
        bfont = get_font(int(H * 0.026))
        draw.text((pad + 16, ty), "  ▸  " + bullet, font=bfont,
                   fill=(*T["subtitle"], 220))
        ty += int(H * 0.042)

    # Hashtags + contact at bottom
    bottom_y = H - int(H * 0.09)
    draw.rectangle([0, bottom_y - 8, W, bottom_y - 6], fill=(*T["accent"], 80))

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.024), bold=True)
        draw.text((pad, bottom_y), "📞  " + contact, font=cfont, fill=(*T["accent"], 255))

    if hashtags := data.get("hashtags", []):
        htext = "  ".join(hashtags)
        hfont = get_font(int(H * 0.022))
        hb = draw.textbbox((0, 0), htext, font=hfont)
        draw.text((W - pad - hb[2], bottom_y), htext, font=hfont, fill=(*T["subtitle"], 200))

    if organizer := data.get("organizer"):
        ofont = get_font(int(H * 0.02))
        draw.text((pad, bottom_y + int(H * 0.038)), "Organisé par : " + organizer,
                   font=ofont, fill=(*T["subtitle"], 180))

    # Bottom bar
    draw.rectangle([0, H - int(H * 0.006), W, H], fill=T["accent"])

    return img.convert("RGB")


# ─── Invitation card ──────────────────────────────────────────────────────────

def render_invitation(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = Image.new("RGB", (W, H), T["bg"])
    draw = ImageDraw.Draw(img)

    # Gradient overlay
    grad = make_gradient((W, H), T["gradient_top"], T["gradient_bot"])
    img.paste(grad.convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(W * 0.07)
    cw  = W - 2 * pad

    # Decorative border frame
    border_w = 8
    accent_rgba = (*T["accent"], 200)
    # Outer corners
    for x0, y0, x1, y1 in [
        (pad - border_w, pad - border_w, pad + 60, pad - border_w + border_w),      # TL h
        (pad - border_w, pad - border_w, pad - border_w + border_w, pad + 60),      # TL v
        (W - pad - 60, pad - border_w, W - pad + border_w, pad - border_w + border_w),  # TR h
        (W - pad, pad - border_w, W - pad + border_w, pad + 60),                    # TR v
        (pad - border_w, H - pad - border_w, pad + 60, H - pad),                   # BL h
        (pad - border_w, H - pad - 60, pad - border_w + border_w, H - pad + border_w), # BL v
        (W - pad - 60, H - pad, W - pad + border_w, H - pad + border_w),           # BR h
        (W - pad, H - pad - 60, W - pad + border_w, H - pad + border_w),           # BR v
    ]:
        draw.rectangle([x0, y0, x1, y1], fill=T["accent"])

    # Logo
    logo_y = pad + 10
    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.10)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            logo_x = (W - lw) // 2
            img.paste(logo, (logo_x, logo_y), logo)
            logo_y += lh + 12

    # "INVITATION" header
    inv_text = "— INVITATION —"
    inv_font = get_font(int(H * 0.025), bold=True)
    inv_bbox = draw.textbbox((0, 0), inv_text, font=inv_font)
    draw.text(((W - inv_bbox[2]) // 2, logo_y + 8), inv_text, font=inv_font, fill=T["accent"])

    # Divider
    div_y = logo_y + 60
    draw.rectangle([pad + 30, div_y, W - pad - 30, div_y + 2], fill=T["accent"])
    div_y += 20

    # Title
    tfont = get_font(int(H * 0.065), bold=True)
    ty = draw_multiline(draw, data.get("title", ""), tfont, pad, div_y, cw,
                         fill=T["text"], align="center", line_spacing=1.1)
    ty += 12

    # Subtitle
    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.032))
        ty = draw_multiline(draw, sub, sfont, pad, ty, cw,
                             fill=T["subtitle"], align="center")
        ty += 10

    # Divider 2
    draw.rectangle([pad + 60, ty + 8, W - pad - 60, ty + 10], fill=(*T["accent"], 120))
    ty += 30

    # Event details in elegant layout
    details = []
    if d := data.get("date"):     details.append(("DATE", d))
    if t := data.get("time"):     details.append(("HEURE", t))
    if l := data.get("location"): details.append(("LIEU", l))
    if p := data.get("price"):    details.append(("TARIF", p))

    label_font = get_font(int(H * 0.020), bold=True)
    value_font = get_font(int(H * 0.030))

    for label, value in details:
        label_bbox = draw.textbbox((0, 0), label, font=label_font)
        draw.text(((W - label_bbox[2]) // 2, ty), label, font=label_font, fill=T["accent"])
        ty += label_bbox[3] + 4
        val_bbox = draw.textbbox((0, 0), value, font=value_font)
        draw.text(((W - val_bbox[2]) // 2, ty), value, font=value_font, fill=T["text"])
        ty += val_bbox[3] + 18

    # Description
    if desc := data.get("description"):
        draw.rectangle([pad + 30, ty + 4, W - pad - 30, ty + 6], fill=(*T["accent"], 80))
        ty += 20
        dfont = get_font(int(H * 0.024))
        ty = draw_multiline(draw, desc, dfont, pad, ty, cw,
                             fill=T["subtitle"], align="center")

    # Contact + organizer at bottom
    if org := data.get("organizer"):
        ofont = get_font(int(H * 0.022))
        ob = draw.textbbox((0, 0), "Organisé par : " + org, font=ofont)
        draw.text(((W - ob[2]) // 2, H - pad - 80), "Organisé par : " + org,
                   font=ofont, fill=T["subtitle"])

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.022), bold=True)
        cb = draw.textbbox((0, 0), "📞 " + contact, font=cfont)
        draw.text(((W - cb[2]) // 2, H - pad - 45), "📞 " + contact,
                   font=cfont, fill=T["accent"])

    return img


# ─── Banner ───────────────────────────────────────────────────────────────────

def render_banner(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient((W, H), T["gradient_top"], T["gradient_bot"], "horizontal").convert("RGB")
    draw = ImageDraw.Draw(img)

    # Accent left bar
    draw.rectangle([0, 0, 8, H], fill=T["accent"])

    pad = int(H * 0.12)
    logo_space = 0

    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.65)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            logo_y = (H - lh) // 2
            img.paste(logo, (20 + pad, logo_y), logo)
            logo_space = lw + 30

    text_x = 20 + pad + logo_space
    text_w = W - text_x - pad

    ty = int(H * 0.15)
    tfont = get_font(int(H * 0.38), bold=True)
    ty = draw_multiline(draw, data.get("title", ""), tfont, text_x, ty,
                         text_w, fill=T["text"], align="left", line_spacing=1.1)

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.20))
        ty = draw_multiline(draw, sub, sfont, text_x, ty + 6, text_w,
                             fill=T["subtitle"], align="left")

    # Right-side CTA
    if cta := (data.get("price") or data.get("badge")):
        cfont = get_font(int(H * 0.22), bold=True)
        cb = draw.textbbox((0, 0), cta, font=cfont)
        cw2, ch = cb[2] + 40, cb[3] + 20
        cx = W - pad - cw2
        cy = (H - ch) // 2
        draw.rounded_rectangle([cx, cy, cx + cw2, cy + ch], radius=12, fill=T["badge_bg"])
        draw.text((cx + 20, cy + 10), cta, font=cfont, fill=T["badge_text"])

    # Bottom accent
    draw.rectangle([0, H - 6, W, H], fill=T["accent"])

    return img


# ─── Social Post ──────────────────────────────────────────────────────────────

def render_social_post(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient((W, H), T["gradient_top"], T["gradient_bot"]).convert("RGB")
    draw = ImageDraw.Draw(img)

    # BG image
    if bg_b64 := data.get("bg_image_base64"):
        bg = load_image_b64(bg_b64)
        if bg:
            bg = bg.convert("RGB").resize((W, H), Image.LANCZOS)
            # Dark overlay
            overlay = Image.new("RGB", (W, H), T["bg"])
            opa = int(data.get("bg_opacity", 0.55) * 255)
            img = Image.blend(bg, overlay, data.get("bg_opacity", 0.55))
            draw = ImageDraw.Draw(img)

    pad = int(W * 0.07)
    cw  = W - 2 * pad

    # Logo
    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.07)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            img.paste(logo, (pad, pad), logo)
            draw = ImageDraw.Draw(img)

    # Badge
    if badge := data.get("badge"):
        badge_color = T["badge_bg"]
        if bc := data.get("badge_color"):
            try:
                badge_color = hex_to_rgb(bc)
            except Exception:
                pass
        bfont = get_font(int(H * 0.028), bold=True)
        bb = draw.textbbox((0, 0), f"  {badge}  ", font=bfont)
        bw = bb[2] + 20
        bh = bb[3] + 14
        draw.rounded_rectangle([W - pad - bw, pad, W - pad, pad + bh], radius=8, fill=badge_color)
        draw.text((W - pad - bw + 10, pad + 7), badge, font=bfont, fill=T["badge_text"])

    # Center content
    cy = int(H * 0.28)
    tfont = get_font(int(H * 0.065), bold=True)
    cy = draw_multiline(draw, data.get("title", ""), tfont, pad, cy, cw,
                         fill=T["text"], align="center", line_spacing=1.12)
    # Accent line
    draw.rectangle([pad + cw // 3, cy + 8, W - pad - cw // 3, cy + 12], fill=T["accent"])
    cy += 25

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.035))
        cy = draw_multiline(draw, sub, sfont, pad, cy, cw, fill=T["subtitle"], align="center")
        cy += 10

    if desc := data.get("description"):
        dfont = get_font(int(H * 0.028))
        cy = draw_multiline(draw, desc, dfont, pad + int(cw * 0.05), cy + 5,
                             int(cw * 0.9), fill=(*T["text"][:3], 210) if len(T["text"]) == 3 else T["text"],
                             align="center")

    for bullet in data.get("bullets", []):
        bfont = get_font(int(H * 0.030))
        draw.text((pad + 20, cy + 8), "▸  " + bullet, font=bfont, fill=T["subtitle"])
        cy += int(H * 0.050)

    # Footer
    foot_y = H - int(H * 0.12)
    draw.rectangle([0, foot_y, W, foot_y + 2], fill=(*T["accent"], 100))

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.028), bold=True)
        draw.text((pad, foot_y + 12), "📞  " + contact, font=cfont, fill=T["accent"])

    if hashtags := data.get("hashtags", []):
        hfont = get_font(int(H * 0.026))
        hy = foot_y + 12
        for ht in hashtags[:4]:
            hb = draw.textbbox((0, 0), ht, font=hfont)
            draw.text((W - pad - hb[2], hy), ht, font=hfont, fill=T["subtitle"])
            hy += int(H * 0.040)

    return img


# ─── Certificate ──────────────────────────────────────────────────────────────

def render_certificate(data: dict, T: dict, W: int, H: int) -> Image.Image:
    # Use light/gold colors for certificates
    if data.get("theme") not in ("gold", "elegant", "light"):
        T = THEMES["elegant"]

    img = Image.new("RGB", (W, H), T["bg"])
    draw = ImageDraw.Draw(img)

    grad = make_gradient((W, H), T["gradient_top"], T["gradient_bot"])
    img.paste(grad.convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img)

    # Outer border
    bw = 12
    draw.rectangle([bw, bw, W - bw, H - bw], outline=T["accent"], width=3)
    draw.rectangle([bw + 8, bw + 8, W - bw - 8, H - bw - 8], outline=(*T["accent"], 80), width=1)

    pad = int(W * 0.08)
    cw  = W - 2 * pad

    # Logo
    ly = pad + 20
    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.10)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            img.paste(logo, ((W - lw) // 2, ly), logo)
            ly += lh + 16

    # "CERTIFICAT" header
    hfont = get_font(int(H * 0.030), bold=True)
    htxt = "✦  CERTIFICAT  ✦"
    hb = draw.textbbox((0, 0), htxt, font=hfont)
    draw.text(((W - hb[2]) // 2, ly + 10), htxt, font=hfont, fill=T["accent"])
    ly += 55

    # Divider
    draw.rectangle([pad + 40, ly, W - pad - 40, ly + 2], fill=T["accent"])
    ly += 20

    # Title
    tfont = get_font(int(H * 0.055), bold=True)
    ty = draw_multiline(draw, data.get("title", ""), tfont, pad, ly, cw,
                         fill=T["text"], align="center", line_spacing=1.1)
    ty += 12

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.030))
        ty = draw_multiline(draw, sub, sfont, pad, ty, cw, fill=T["subtitle"], align="center")
        ty += 10

    draw.rectangle([pad + 80, ty + 6, W - pad - 80, ty + 8], fill=(*T["accent"], 100))
    ty += 28

    if desc := data.get("description"):
        dfont = get_font(int(H * 0.028))
        ty = draw_multiline(draw, desc, dfont, pad + 30, ty, cw - 60,
                             fill=T["text"], align="center")
        ty += 16

    # Date bottom
    if d := data.get("date"):
        dyfont = get_font(int(H * 0.025))
        db = draw.textbbox((0, 0), d, font=dyfont)
        draw.text(((W - db[2]) // 2, H - pad - 70), d, font=dyfont, fill=T["subtitle"])

    # Organizer / Signature zone
    sig_y = H - pad - 36
    if org := data.get("organizer"):
        ofont = get_font(int(H * 0.022), bold=True)
        draw.rectangle([pad + 40, sig_y - 4, pad + 200, sig_y - 2], fill=T["accent"])
        draw.text((pad + 40, sig_y + 2), org, font=ofont, fill=T["text"])

    return img


# ─── Business card ────────────────────────────────────────────────────────────

def render_business_card(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient((W, H), T["gradient_top"], T["gradient_bot"], "horizontal").convert("RGB")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 10, H], fill=T["accent"])

    pad = int(H * 0.15)

    if logo_b64 := data.get("logo_base64"):
        logo = load_image_b64(logo_b64)
        if logo:
            lh = int(H * 0.55)
            lw = int(logo.width * lh / logo.height)
            logo = logo.resize((lw, lh), Image.LANCZOS)
            img.paste(logo, (20 + pad, (H - lh) // 2), logo)

    tx = int(W * 0.38)
    ty = pad

    if name := (data.get("title") or data.get("organizer")):
        nfont = get_font(int(H * 0.22), bold=True)
        draw.text((tx, ty), name, font=nfont, fill=T["text"])
        ty += int(H * 0.26)

    if sub := (data.get("subtitle") or data.get("brand_name")):
        sfont = get_font(int(H * 0.14))
        draw.text((tx, ty), sub, font=sfont, fill=T["accent"])
        ty += int(H * 0.18)

    draw.rectangle([tx, ty + 4, tx + int(W * 0.4), ty + 6], fill=T["accent"])
    ty += 20

    for item in [data.get("contact"), data.get("location")]:
        if item:
            ifont = get_font(int(H * 0.12))
            draw.text((tx, ty), item, font=ifont, fill=T["subtitle"])
            ty += int(H * 0.16)

    draw.rectangle([0, H - 6, W, H], fill=T["accent"])
    return img


# ─── Router ───────────────────────────────────────────────────────────────────

RENDERERS = {
    "poster":        render_poster,
    "flyer":         render_poster,
    "invitation":    render_invitation,
    "banner":        render_banner,
    "banner_wide":   render_banner,
    "social_post":   render_social_post,
    "social":        render_social_post,
    "certificate":   render_certificate,
    "business_card": render_business_card,
}


def generate_visual(data: dict[str, Any]) -> bytes:
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow (PIL) is not installed. Run: pip install Pillow")

    visual_type = data.get("visual_type", "poster").lower()
    fmt_name    = data.get("format", "portrait").lower()
    theme_name  = data.get("theme", DEFAULT_THEME).lower()
    out_fmt     = data.get("output_format", "png").lower()
    quality     = int(data.get("quality", 90))

    W, H = FORMATS.get(fmt_name, FORMATS["portrait"])
    T    = THEMES.get(theme_name, THEMES[DEFAULT_THEME]).copy()

    # Override brand_color
    if brand_hex := data.get("brand_color"):
        try:
            T["accent"] = hex_to_rgb(brand_hex)
        except Exception:
            pass

    renderer = RENDERERS.get(visual_type, render_poster)
    img = renderer(data, T, W, H)

    buf = io.BytesIO()
    if out_fmt in ("jpg", "jpeg"):
        img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
    else:
        img.save(buf, format="PNG", optimize=True)

    return buf.getvalue()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        raw = sys.stdin.buffer.read()
        data = json.loads(raw)
    except Exception as e:
        sys.stderr.write(f"JSON parse error: {e}\n")
        sys.exit(1)

    try:
        result = generate_visual(data)
    except Exception:
        sys.stderr.write(f"Visual generation error:\n{traceback.format_exc()}\n")
        sys.exit(2)

    sys.stdout.buffer.write(result)


if __name__ == "__main__":
    main()
