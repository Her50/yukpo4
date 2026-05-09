#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YukpoIA Visual Generator — v2 PROFESSIONAL
Multi-layer composition with decorative geometry, rich typography, context-aware layouts.
Reads JSON spec from stdin, writes PNG/JPEG to stdout.
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
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ─── Theme palettes ───────────────────────────────────────────────────────────

THEMES: dict[str, dict] = {
    "blue": {
        "bg1": (5, 18, 55), "bg2": (0, 60, 130), "bg3": (0, 100, 200),
        "accent1": (0, 190, 255), "accent2": (255, 200, 0),
        "text": (255, 255, 255), "text2": (180, 215, 255), "text3": (130, 170, 230),
        "card": (15, 45, 100, 210), "overlay": (0, 10, 40, 180),
        "badge_bg": (255, 200, 0), "badge_text": (10, 20, 50),
        "divider": (0, 190, 255), "star": (255, 210, 50),
    },
    "green": {
        "bg1": (5, 30, 15), "bg2": (10, 80, 35), "bg3": (20, 140, 65),
        "accent1": (50, 230, 120), "accent2": (255, 220, 30),
        "text": (255, 255, 255), "text2": (180, 255, 210), "text3": (130, 210, 160),
        "card": (10, 55, 25, 210), "overlay": (0, 20, 10, 180),
        "badge_bg": (255, 220, 30), "badge_text": (5, 30, 15),
        "divider": (50, 230, 120), "star": (255, 230, 80),
    },
    "purple": {
        "bg1": (20, 5, 50), "bg2": (70, 10, 130), "bg3": (120, 30, 200),
        "accent1": (200, 110, 255), "accent2": (255, 180, 50),
        "text": (255, 255, 255), "text2": (220, 190, 255), "text3": (180, 150, 230),
        "card": (50, 15, 100, 210), "overlay": (15, 5, 40, 180),
        "badge_bg": (255, 180, 50), "badge_text": (20, 5, 50),
        "divider": (200, 110, 255), "star": (255, 200, 80),
    },
    "orange": {
        "bg1": (40, 12, 0), "bg2": (150, 50, 0), "bg3": (220, 90, 0),
        "accent1": (255, 160, 20), "accent2": (255, 255, 100),
        "text": (255, 255, 255), "text2": (255, 225, 175), "text3": (230, 185, 130),
        "card": (80, 30, 0, 210), "overlay": (30, 10, 0, 180),
        "badge_bg": (255, 255, 100), "badge_text": (40, 12, 0),
        "divider": (255, 160, 20), "star": (255, 240, 100),
    },
    "dark": {
        "bg1": (8, 8, 16), "bg2": (18, 18, 35), "bg3": (30, 30, 55),
        "accent1": (0, 220, 255), "accent2": (160, 255, 100),
        "text": (235, 235, 250), "text2": (165, 180, 220), "text3": (120, 140, 185),
        "card": (22, 22, 45, 220), "overlay": (5, 5, 15, 200),
        "badge_bg": (0, 220, 130), "badge_text": (8, 8, 16),
        "divider": (0, 220, 255), "star": (200, 255, 130),
    },
    "light": {
        "bg1": (240, 243, 255), "bg2": (210, 220, 250), "bg3": (180, 200, 245),
        "accent1": (40, 90, 210), "accent2": (255, 120, 30),
        "text": (20, 25, 60), "text2": (60, 85, 160), "text3": (100, 120, 190),
        "card": (220, 228, 255, 210), "overlay": (180, 200, 240, 150),
        "badge_bg": (255, 120, 30), "badge_text": (255, 255, 255),
        "divider": (40, 90, 210), "star": (255, 150, 30),
    },
    "gold": {
        "bg1": (12, 8, 2), "bg2": (55, 38, 5), "bg3": (100, 70, 10),
        "accent1": (255, 215, 0), "accent2": (255, 255, 180),
        "text": (255, 245, 200), "text2": (220, 195, 120), "text3": (180, 155, 90),
        "card": (40, 28, 5, 220), "overlay": (12, 8, 2, 190),
        "badge_bg": (255, 215, 0), "badge_text": (12, 8, 2),
        "divider": (255, 215, 0), "star": (255, 240, 120),
    },
    "elegant": {
        "bg1": (10, 10, 12), "bg2": (22, 20, 18), "bg3": (38, 34, 28),
        "accent1": (195, 165, 100), "accent2": (235, 210, 160),
        "text": (240, 235, 222), "text2": (195, 182, 155), "text3": (155, 145, 125),
        "card": (28, 25, 20, 220), "overlay": (10, 8, 6, 200),
        "badge_bg": (195, 165, 100), "badge_text": (10, 10, 12),
        "divider": (195, 165, 100), "star": (220, 195, 130),
    },
    "red": {
        "bg1": (40, 5, 5), "bg2": (120, 10, 10), "bg3": (190, 20, 20),
        "accent1": (255, 80, 60), "accent2": (255, 220, 50),
        "text": (255, 255, 255), "text2": (255, 200, 195), "text3": (230, 165, 160),
        "card": (80, 12, 12, 210), "overlay": (30, 5, 5, 185),
        "badge_bg": (255, 220, 50), "badge_text": (40, 5, 5),
        "divider": (255, 80, 60), "star": (255, 230, 80),
    },
    "corporate": {
        "bg1": (245, 247, 250), "bg2": (225, 232, 245), "bg3": (200, 215, 240),
        "accent1": (25, 65, 140), "accent2": (200, 30, 30),
        "text": (15, 25, 60), "text2": (50, 75, 140), "text3": (90, 115, 175),
        "card": (210, 220, 245, 220), "overlay": (185, 205, 235, 160),
        "badge_bg": (200, 30, 30), "badge_text": (255, 255, 255),
        "divider": (25, 65, 140), "star": (200, 30, 30),
    },
}
DEFAULT_THEME = "blue"

FORMATS: dict[str, tuple[int, int]] = {
    "square":        (1080, 1080),
    "portrait":      (1080, 1350),
    "landscape":     (1200, 630),
    "story":         (1080, 1920),
    "banner_wide":   (1500, 500),
    "a4":            (2480, 3508),
    "business_card": (1050, 600),
    "ticket":        (1400, 650),
    "square_large":  (2000, 2000),
}

# ─── Font resolution ──────────────────────────────────────────────────────────

_FONT_CACHE: dict[tuple, ImageFont.ImageFont] = {}

FONT_FAMILIES = {
    "bold": [
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/georgiab.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
    ],
    "regular": [
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/georgia.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ],
    "italic": [
        "C:/Windows/Fonts/calibrii.ttf",
        "C:/Windows/Fonts/ariali.ttf",
        "C:/Windows/Fonts/georgiai.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf",
    ],
    "emoji": [
        "C:/Windows/Fonts/seguiemj.ttf",
        "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
        "/usr/share/fonts/noto/NotoColorEmoji.ttf",
    ],
}

def get_font(size: int, style: str = "regular") -> ImageFont.ImageFont:
    key = (size, style)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]
    for path in FONT_FAMILIES.get(style, FONT_FAMILIES["regular"]):
        if os.path.exists(path):
            try:
                f = ImageFont.truetype(path, size)
                _FONT_CACHE[key] = f
                return f
            except Exception:
                continue
    f = ImageFont.load_default()
    _FONT_CACHE[key] = f
    return f


# ─── Utility helpers ──────────────────────────────────────────────────────────

def decode_b64(s: str) -> bytes | None:
    try:
        d = s.strip()
        if "," in d:
            d = d.split(",", 1)[1]
        return base64.b64decode(d)
    except Exception:
        return None


def load_image_b64(b64: str) -> Image.Image | None:
    b = decode_b64(b64)
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


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_color(c1, c2, t):
    return tuple(max(0, min(255, int(lerp(c1[i], c2[i], t)))) for i in range(len(c1)))


def rgba(rgb: tuple, a: int = 255) -> tuple:
    return (*rgb[:3], a)


def lighten(c: tuple, amount: float = 0.2) -> tuple:
    return tuple(min(255, int(v + (255 - v) * amount)) for v in c[:3])


def darken(c: tuple, amount: float = 0.3) -> tuple:
    return tuple(max(0, int(v * (1 - amount))) for v in c[:3])


# ─── Drawing primitives ───────────────────────────────────────────────────────

def make_gradient_bg(W: int, H: int, c1: tuple, c2: tuple, c3: tuple | None = None,
                     direction: str = "vertical") -> Image.Image:
    img = Image.new("RGBA", (W, H), (*c1, 255))
    pixels = img.load()
    for y in range(H):
        for x in range(W):
            if direction == "diagonal":
                t = (x / W * 0.4 + y / H * 0.6)
            elif direction == "radial":
                cx, cy = W / 2, H / 2
                t = min(1.0, math.sqrt(((x - cx) / W) ** 2 + ((y - cy) / H) ** 2) * 1.6)
            elif direction == "horizontal":
                t = x / W
            else:
                t = y / H
            t = max(0.0, min(1.0, t))
            if c3 and t > 0.5:
                c = lerp_color(c2, c3, (t - 0.5) * 2)
            else:
                c = lerp_color(c1, c2, t * (2 if c3 else 1))
            pixels[x, y] = (*c, 255)
    return img


def draw_rounded_rect(draw, xy, radius: int, fill=None, outline=None, width: int = 2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def draw_circle(draw, cx: int, cy: int, r: int, fill=None, outline=None, width: int = 2):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=width)


def draw_polygon_shape(draw, cx, cy, sides, r, rotation=0, fill=None):
    pts = []
    for i in range(sides):
        angle = rotation + 2 * math.pi * i / sides
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    draw.polygon(pts, fill=fill)


def add_glow_circle(img: Image.Image, cx: int, cy: int, r: int, color: tuple, intensity: float = 0.6):
    """Add a soft glowing circle as a separate layer."""
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    steps = 8
    for i in range(steps, 0, -1):
        alpha = int(intensity * 255 * (1 - i / steps) * (1 - i / steps) * 0.5)
        rad = r + i * (r // 4)
        gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad],
                   fill=(*color[:3], alpha))
    draw_circle(gd, cx, cy, r, fill=(*color[:3], int(intensity * 200)))
    img.alpha_composite(glow)


def add_decorative_circles(img: Image.Image, T: dict, W: int, H: int, seed: int = 0):
    """Add semi-transparent decorative circles for depth."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    configs = [
        # (cx_frac, cy_frac, r_frac, color_key, alpha)
        (0.85, 0.12, 0.25, "accent1", 30),
        (0.10, 0.88, 0.30, "bg3", 50),
        (0.75, 0.75, 0.18, "accent2", 20),
        (0.05, 0.15, 0.15, "accent1", 20),
        (0.55, 0.05, 0.10, "accent2", 25),
    ]
    for i, (cfx, cfy, rfrac, ckey, alpha) in enumerate(configs):
        cx = int((cfx + seed * 0.03 * (i % 3 - 1)) * W)
        cy = int(cfy * H)
        r = int(rfrac * min(W, H))
        col = T.get(ckey, T["accent1"])
        add_glow_circle(layer, cx, cy, r, col, intensity=alpha / 255)
    img.alpha_composite(layer)


def add_geometric_accents(draw: ImageDraw.ImageDraw, T: dict, W: int, H: int,
                           visual_type: str = "poster"):
    """Add thin geometric lines and shapes for professional feel."""
    a1 = T["accent1"]
    a2 = T["accent2"]

    if visual_type in ("invitation", "certificate"):
        # Corner flourishes
        c_size = int(min(W, H) * 0.08)
        lw = max(2, int(min(W, H) * 0.003))
        corners = [(c_size, c_size), (W - c_size, c_size),
                   (c_size, H - c_size), (W - c_size, H - c_size)]
        offsets = [(1, 1), (-1, 1), (1, -1), (-1, -1)]
        for (cx, cy), (ox, oy) in zip(corners, offsets):
            draw.line([(cx, cy), (cx + ox * c_size * 0.6, cy)], fill=(*a1, 180), width=lw)
            draw.line([(cx, cy), (cx, cy + oy * c_size * 0.6)], fill=(*a1, 180), width=lw)
            # Small diamond at corner
            draw_polygon_shape(draw, cx, cy, 4, int(c_size * 0.12),
                                rotation=math.pi / 4, fill=(*a2, 200))

    elif visual_type in ("poster", "flyer", "social_post"):
        # Diagonal accent lines top-right
        lw = max(2, int(W * 0.003))
        for i in range(3):
            offset = i * int(W * 0.04)
            alpha = 60 - i * 15
            draw.line([(W - offset, 0), (W, offset)], fill=(*a1, alpha), width=lw)

        # Bottom-left accent
        for i in range(2):
            offset = i * int(W * 0.05)
            draw.line([(0, H - offset), (offset, H)], fill=(*a2, 40 - i * 15), width=lw)

    elif visual_type == "banner":
        # Vertical accent marks
        lw = max(3, int(H * 0.02))
        for i in range(4):
            x = int(W * (0.22 + i * 0.18))
            draw.line([(x, int(H * 0.15)), (x, int(H * 0.85))],
                       fill=(*a1, 20 + i * 5), width=lw)


def text_size(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    bb = draw.textbbox((0, 0), text, font=font)
    return (bb[2] - bb[0], bb[3] - bb[1])


def draw_text_centered(draw, text: str, font, cx: int, y: int, fill,
                        shadow: bool = False, shadow_col=(0, 0, 0, 120)):
    w, _ = text_size(draw, text, font)
    x = cx - w // 2
    if shadow:
        draw.text((x + 3, y + 3), text, font=font, fill=shadow_col)
    draw.text((x, y), text, font=font, fill=fill)
    return y + text_size(draw, text, font)[1]


def draw_multiline_wrapped(draw, text: str, font, x: int, y: int,
                            max_w: int, fill, align: str = "left",
                            line_spacing: float = 1.3,
                            shadow: bool = False,
                            max_lines: int = 0,
                            max_y: int = 0) -> int:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        tw, _ = text_size(draw, test, font)
        if tw <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if not lines:
        lines = [text]

    # Truncate with ellipsis if max_lines exceeded
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            last = lines[-1]
            while last and text_size(draw, last + "...", font)[0] > max_w:
                last = last[:-1]
            lines[-1] = last + "..."

    _, fh = text_size(draw, "Ag", font)
    lh = int(fh * line_spacing)

    for line in lines:
        # Skip if would draw past max_y limit
        if max_y and y + fh > max_y:
            break
        lw, _ = text_size(draw, line, font)
        if align == "center":
            lx = x + (max_w - lw) // 2
        elif align == "right":
            lx = x + max_w - lw
        else:
            lx = x
        if shadow:
            draw.text((lx + 2, y + 2), line, font=font, fill=(0, 0, 0, 120))
        draw.text((lx, y), line, font=font, fill=fill)
        y += lh
    return y


def draw_badge(draw, text: str, font, x: int, y: int, bg_color, text_color,
               radius: int = 12, padding: int = 16) -> tuple[int, int]:
    tw, th = text_size(draw, text, font)
    bw = tw + padding * 2
    bh = th + padding
    draw_rounded_rect(draw, [x, y, x + bw, y + bh], radius, fill=bg_color)
    draw.text((x + padding, y + padding // 2), text, font=font, fill=text_color)
    return bw, bh


def embed_logo(img: Image.Image, logo_b64: str, x: int, y: int, max_h: int,
               shadow: bool = False) -> int:
    """Embed logo, returns actual width placed."""
    logo = load_image_b64(logo_b64)
    if not logo:
        return 0
    scale = max_h / logo.height
    new_w = int(logo.width * scale)
    logo = logo.resize((new_w, max_h), Image.LANCZOS)
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        for dx, dy, a in [(4, 4, 60), (3, 3, 40), (2, 2, 25)]:
            sh.paste((0, 0, 0, a), [x + dx, y + dy, x + dx + new_w, y + dy + max_h])
        img.alpha_composite(sh)
    img.paste(logo, (x, y), logo)
    return new_w


def apply_bg_image(img: Image.Image, bg_b64: str, opacity: float = 0.3) -> Image.Image:
    bg = load_image_b64(bg_b64)
    if not bg:
        return img
    W, H = img.size
    bg = bg.convert("RGB").resize((W, H), Image.LANCZOS)
    bg_rgba = bg.convert("RGBA")
    # Darken/blend
    dark = Image.new("RGBA", (W, H), (*img.getpixel((0, 0))[:3], 255))
    blended = Image.blend(bg_rgba, dark, 1 - opacity)
    base = Image.new("RGBA", (W, H))
    base.paste(blended, (0, 0))
    base.alpha_composite(img)
    return base


def info_icon(text: str) -> str:
    """Return text-safe icon prefix (no emoji for font compatibility)."""
    return text  # Use text directly; icons optional


# ─── Poster / Flyer ───────────────────────────────────────────────────────────

def render_poster(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], T["bg3"], "diagonal")
    add_decorative_circles(img, T, W, H)

    # BG image if provided
    if bg_b64 := data.get("bg_image_base64"):
        opacity = float(data.get("bg_opacity", 0.28))
        img = apply_bg_image(img.convert("RGBA"), bg_b64, opacity)

    draw = ImageDraw.Draw(img, "RGBA")
    add_geometric_accents(draw, T, W, H, "poster")

    pad = int(W * 0.065)
    cw = W - 2 * pad
    cy = 0

    # ── Top bar ──
    bar_h = int(H * 0.007)
    draw.rectangle([0, 0, W, bar_h], fill=(*T["accent1"], 255))

    # ── Logo + Brand top ──
    logo_h = int(H * 0.075)
    logo_y = bar_h + int(H * 0.022)
    logo_w = 0
    if logo_b64 := data.get("logo_base64"):
        logo_w = embed_logo(img, logo_b64, pad, logo_y, logo_h, shadow=True)
        draw = ImageDraw.Draw(img, "RGBA")

    if brand := data.get("brand_name"):
        bfont = get_font(int(H * 0.027), "bold")
        bx = pad + logo_w + 12 if logo_w else W // 2
        balign = "left" if logo_w else "center"
        _, bh = text_size(draw, brand, bfont)
        by = logo_y + (logo_h - bh) // 2
        if balign == "center":
            draw_text_centered(draw, brand, bfont, W // 2, by, fill=(*T["accent1"], 255))
        else:
            draw.text((bx, by), brand, font=bfont, fill=(*T["accent1"], 255))

    # ── Badge top-right ──
    if badge := data.get("badge"):
        badge_col = T["badge_bg"]
        if bch := data.get("badge_color"):
            try: badge_col = hex_to_rgb(bch)
            except: pass
        bfont = get_font(int(H * 0.022), "bold")
        bw, bh = draw_badge(draw, badge, bfont, 0, 0, badge_col, T["badge_text"], 14, 18)
        draw_badge(draw, badge, bfont, W - pad - bw, logo_y, badge_col, T["badge_text"], 14, 18)

    # ── Main title ──
    cy = logo_y + logo_h + int(H * 0.04)
    title = data.get("title", "")
    title_size = max(int(W * 0.072), 52)
    tfont = get_font(title_size, "bold")
    # Decorative accent before title
    draw.rectangle([pad, cy, pad + int(cw * 0.12), cy + int(H * 0.006)],
                   fill=(*T["accent2"], 255))
    cy += int(H * 0.018)
    cy = draw_multiline_wrapped(draw, title, tfont, pad, cy, cw,
                                 fill=(*T["text"], 255), align="left",
                                 line_spacing=1.1, shadow=True)
    cy += int(H * 0.012)

    # ── Subtitle ──
    if subtitle := data.get("subtitle"):
        sfont = get_font(int(H * 0.032), "italic")
        cy = draw_multiline_wrapped(draw, subtitle, sfont, pad, cy, cw,
                                     fill=(*T["text2"], 230), align="left",
                                     line_spacing=1.2)
        cy += int(H * 0.016)

    # ── Divider ──
    draw.rectangle([pad, cy, pad + int(cw * 0.5), cy + int(H * 0.003)],
                   fill=(*T["accent1"], 200))
    cy += int(H * 0.024)

    # ── Description ──
    if desc := data.get("description"):
        dfont = get_font(int(H * 0.027), "regular")
        cy = draw_multiline_wrapped(draw, desc, dfont, pad, cy, cw,
                                     fill=(*T["text2"], 200), align="left",
                                     line_spacing=1.4)
        cy += int(H * 0.02)

    # ── Info card (date, time, location, price) ──
    infos = []
    if d := data.get("date"):      infos.append(("DATE", d))
    if t := data.get("time"):      infos.append(("HEURE", t))
    if l := data.get("location"):  infos.append(("LIEU", l))
    if p := data.get("price"):     infos.append(("TARIF", p))

    if infos:
        card_pad = int(W * 0.045)
        lbl_font = get_font(int(H * 0.018), "bold")
        val_font = get_font(int(H * 0.028), "regular")
        line_h = int(H * 0.065)
        card_h = len(infos) * line_h + card_pad * 2

        # Card background
        draw.rounded_rectangle(
            [pad, cy, pad + cw, cy + card_h],
            radius=18, fill=T["card"]
        )
        # Left accent bar
        draw.rounded_rectangle(
            [pad, cy, pad + 6, cy + card_h],
            radius=3, fill=(*T["accent1"], 255)
        )
        for i, (lbl, val) in enumerate(infos):
            iy = cy + card_pad + i * line_h
            draw.text((pad + card_pad, iy), lbl, font=lbl_font, fill=(*T["accent1"], 255))
            lw, lh = text_size(draw, lbl, lbl_font)
            draw.text((pad + card_pad + lw + 12, iy + (lh - text_size(draw, val, val_font)[1]) // 2),
                       val, font=val_font, fill=(*T["text"], 240))
        cy += card_h + int(H * 0.018)

    # ── Bullets ──
    for bullet in data.get("bullets", []):
        bfont = get_font(int(H * 0.026), "regular")
        bh_px = text_size(draw, bullet, bfont)[1]
        # Dot
        dot_r = int(H * 0.008)
        dot_cx = pad + dot_r + 4
        draw_circle(draw, dot_cx, cy + bh_px // 2, dot_r, fill=(*T["accent1"], 220))
        draw.text((pad + dot_r * 2 + 14, cy), bullet, font=bfont, fill=(*T["text2"], 220))
        cy += int(bh_px * 1.5)

    # ── Footer ──
    foot_y = H - int(H * 0.085)
    draw.rectangle([0, foot_y, W, foot_y + int(H * 0.003)], fill=(*T["accent1"], 100))

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.026), "bold")
        draw.text((pad, foot_y + int(H * 0.016)), contact, font=cfont,
                   fill=(*T["accent1"], 255))

    if htags := data.get("hashtags", []):
        hfont = get_font(int(H * 0.022), "regular")
        htext = "  ".join(str(h) for h in htags[:4])
        hw, _ = text_size(draw, htext, hfont)
        draw.text((W - pad - hw, foot_y + int(H * 0.018)), htext, font=hfont,
                   fill=(*T["text3"], 200))

    if org := data.get("organizer"):
        ofont = get_font(int(H * 0.020), "italic")
        draw.text((pad, foot_y + int(H * 0.048)), "Organisé par : " + org, font=ofont,
                   fill=(*T["text3"], 180))

    # Bottom bar
    draw.rectangle([0, H - int(H * 0.005), W, H], fill=(*T["accent1"], 255))

    return img.convert("RGB")


# ─── Invitation ───────────────────────────────────────────────────────────────

def render_invitation(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], T["bg3"], "radial")
    add_decorative_circles(img, T, W, H, seed=2)
    draw = ImageDraw.Draw(img, "RGBA")
    add_geometric_accents(draw, T, W, H, "invitation")

    pad  = int(W * 0.08)
    cw   = W - 2 * pad
    cy   = int(H * 0.04)

    # ── Outer border ──
    bw = max(3, int(min(W, H) * 0.003))
    draw.rectangle([bw * 2, bw * 2, W - bw * 2, H - bw * 2],
                   outline=(*T["accent1"], 180), width=bw)
    inner = bw * 2 + max(8, int(min(W, H) * 0.012))
    draw.rectangle([inner, inner, W - inner, H - inner],
                   outline=(*T["accent1"], 70), width=max(1, bw // 2))

    # ── Logo ──
    logo_h = int(H * 0.10)
    if logo_b64 := data.get("logo_base64"):
        lw = embed_logo(img, logo_b64, 0, 0, logo_h)
        draw = ImageDraw.Draw(img, "RGBA")
        # Re-center: recalc
        logo = load_image_b64(logo_b64)
        if logo:
            scale = logo_h / logo.height
            new_w = int(logo.width * scale)
            lx = (W - new_w) // 2
            img2 = make_gradient_bg(W, H, T["bg1"], T["bg2"], T["bg3"], "radial")
            img2.paste(img.convert("RGBA"), (0, 0), img.convert("RGBA") if img.mode == "RGBA" else None)
            logo_resized = logo.resize((new_w, logo_h), Image.LANCZOS)
            img.paste(logo_resized, (lx, cy + int(H * 0.02)), logo_resized)
            draw = ImageDraw.Draw(img, "RGBA")
            cy += logo_h + int(H * 0.025)

    # ── "INVITATION" header ──
    hfont = get_font(int(H * 0.028), "bold")
    htxt = "-  INVITATION  -"
    draw_text_centered(draw, htxt, hfont, W // 2, cy, fill=(*T["accent1"], 255))
    cy += text_size(draw, htxt, hfont)[1] + int(H * 0.012)

    # Ornament divider
    star_r = int(W * 0.012)
    draw_circle(draw, W // 2, cy, star_r, fill=(*T["accent2"], 255))
    draw.rectangle([pad + 40, cy + star_r // 2 - 1, W // 2 - star_r - 10, cy + star_r // 2 + 1],
                   fill=(*T["accent1"], 180))
    draw.rectangle([W // 2 + star_r + 10, cy + star_r // 2 - 1, W - pad - 40, cy + star_r // 2 + 1],
                   fill=(*T["accent1"], 180))
    cy += star_r * 2 + int(H * 0.018)

    # ── Title ──
    title = data.get("title", "")
    tfont_sz = max(int(H * 0.062), 42)
    tfont = get_font(tfont_sz, "bold")
    ty = draw_multiline_wrapped(draw, title, tfont, pad, cy, cw,
                                 fill=(*T["text"], 255), align="center",
                                 line_spacing=1.1, shadow=True)
    cy = ty + int(H * 0.010)

    # ── Subtitle ──
    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.030), "italic")
        cy = draw_multiline_wrapped(draw, sub, sfont, pad, cy, cw,
                                     fill=(*T["text2"], 230), align="center",
                                     line_spacing=1.2)
        cy += int(H * 0.010)

    # Divider line
    draw.rectangle([pad + 60, cy + 4, W - pad - 60, cy + 6],
                   fill=(*T["accent1"], 120))
    cy += int(H * 0.026)

    # ── Event details grid ──
    details = []
    if d := data.get("date"):      details.append(("DATE", d))
    if t := data.get("time"):      details.append(("HEURE", t))
    if l := data.get("location"):  details.append(("LIEU", l))
    if p := data.get("price"):     details.append(("TARIF", p))

    lbl_font = get_font(int(H * 0.020), "bold")
    val_font = get_font(int(H * 0.030), "regular")

    for lbl, val in details:
        # Label
        lw, lh = text_size(draw, lbl, lbl_font)
        draw.text(((W - lw) // 2, cy), lbl, font=lbl_font, fill=(*T["accent1"], 255))
        cy += lh + 3
        # Value
        vw, vh = text_size(draw, val, val_font)
        draw.text(((W - vw) // 2, cy), val, font=val_font, fill=(*T["text"], 240))
        cy += vh + int(H * 0.018)

    # ── Description ──
    if desc := data.get("description"):
        draw.rectangle([pad + 60, cy, W - pad - 60, cy + 2], fill=(*T["accent1"], 60))
        cy += int(H * 0.014)
        dfont = get_font(int(H * 0.024), "italic")
        cy = draw_multiline_wrapped(draw, desc, dfont, pad + 20, cy, cw - 40,
                                     fill=(*T["text2"], 200), align="center",
                                     line_spacing=1.4)
        cy += int(H * 0.010)

    # ── Footer: organizer + contact ──
    foot_y = H - int(H * 0.10)
    draw.rectangle([pad + 40, foot_y, W - pad - 40, foot_y + 2],
                   fill=(*T["accent1"], 80))
    foot_y += int(H * 0.016)

    if org := data.get("organizer"):
        ofont = get_font(int(H * 0.022), "italic")
        ow, _ = text_size(draw, "Organisé par : " + org, ofont)
        draw.text(((W - ow) // 2, foot_y), "Organisé par : " + org,
                   font=ofont, fill=(*T["text3"], 200))
        foot_y += int(H * 0.032)

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.024), "bold")
        cw2, _ = text_size(draw, contact, cfont)
        draw.text(((W - cw2) // 2, foot_y), contact, font=cfont,
                   fill=(*T["accent1"], 255))

    # Border corners (small stars)
    corner_r = int(min(W, H) * 0.012)
    for cx2, cy2 in [(pad, pad), (W - pad, pad), (pad, H - pad), (W - pad, H - pad)]:
        draw_polygon_shape(draw, cx2, cy2, 4, corner_r,
                           rotation=math.pi / 4, fill=(*T["accent2"], 200))

    return img.convert("RGB")


# ─── Banner ───────────────────────────────────────────────────────────────────

def render_banner(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], direction="horizontal")
    draw = ImageDraw.Draw(img, "RGBA")
    add_geometric_accents(draw, T, W, H, "banner")

    # Left accent bar
    bar_w = max(8, int(W * 0.006))
    draw.rectangle([0, 0, bar_w, H], fill=(*T["accent1"], 255))

    # Decorative circle top-right
    cr = int(H * 1.2)
    add_glow_circle(img, W + cr // 3, -cr // 4, cr, T["bg3"], 0.5)
    draw = ImageDraw.Draw(img, "RGBA")

    pad = int(H * 0.15)
    lx = bar_w + pad
    logo_space = 0

    if logo_b64 := data.get("logo_base64"):
        lh = int(H * 0.60)
        logo_space = embed_logo(img, logo_b64, lx, (H - lh) // 2, lh, shadow=True)
        draw = ImageDraw.Draw(img, "RGBA")
        logo_space += int(H * 0.12)

    tx = lx + logo_space
    tw = int(W * 0.60) - logo_space
    ty = int(H * 0.18)

    title = data.get("title", "")
    tfont = get_font(int(H * 0.36), "bold")
    ty = draw_multiline_wrapped(draw, title, tfont, tx, ty, tw,
                                 fill=(*T["text"], 255), align="left",
                                 line_spacing=1.05, shadow=True)

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.18), "regular")
        draw_multiline_wrapped(draw, sub, sfont, tx, ty + int(H * 0.04), tw,
                                fill=(*T["text2"], 210), align="left")

    # Right side CTA card
    cta_text = data.get("badge") or data.get("price") or data.get("date") or ""
    if cta_text:
        cta_w = int(W * 0.22)
        cta_x = W - cta_w - pad
        draw.rounded_rectangle([cta_x, int(H * 0.12), cta_x + cta_w, H - int(H * 0.12)],
                                radius=16, fill=(*T["badge_bg"], 255))
        cfont = get_font(int(H * 0.22), "bold")
        _, ch = text_size(draw, cta_text, cfont)
        draw.text((cta_x + (cta_w - text_size(draw, cta_text, cfont)[0]) // 2,
                   (H - ch) // 2), cta_text, font=cfont, fill=(*T["badge_text"], 255))

    if contact := data.get("contact"):
        cfont2 = get_font(int(H * 0.14), "bold")
        draw.text((tx, H - pad - text_size(draw, contact, cfont2)[1]),
                   contact, font=cfont2, fill=(*T["accent1"], 255))

    draw.rectangle([0, H - max(4, int(H * 0.025)), W, H], fill=(*T["accent1"], 255))

    return img.convert("RGB")


# ─── Social Post ──────────────────────────────────────────────────────────────

def render_social_post(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], T["bg3"], "diagonal")
    add_decorative_circles(img, T, W, H, seed=1)

    if bg_b64 := data.get("bg_image_base64"):
        opacity = float(data.get("bg_opacity", 0.32))
        img = apply_bg_image(img.convert("RGBA"), bg_b64, opacity)

    draw = ImageDraw.Draw(img, "RGBA")
    add_geometric_accents(draw, T, W, H, "social_post")

    pad = int(W * 0.07)
    cw  = W - 2 * pad
    cy  = int(H * 0.06)

    # Top: logo + badge
    logo_h = int(H * 0.07)
    if logo_b64 := data.get("logo_base64"):
        lw = embed_logo(img, logo_b64, pad, cy, logo_h, shadow=True)
        draw = ImageDraw.Draw(img, "RGBA")

    if badge := data.get("badge"):
        bc = T["badge_bg"]
        if bch := data.get("badge_color"):
            try: bc = hex_to_rgb(bch)
            except: pass
        bfont = get_font(int(H * 0.026), "bold")
        bw, bh = draw_badge(draw, badge, bfont, 0, 0, bc, T["badge_text"], 12, 16)
        draw_badge(draw, badge, bfont, W - pad - bw, cy, bc, T["badge_text"], 12, 16)

    cy = int(H * 0.22)

    # Large title
    tfont = get_font(int(H * 0.068), "bold")
    ty = draw_multiline_wrapped(draw, data.get("title", ""), tfont, pad, cy, cw,
                                 fill=(*T["text"], 255), align="center",
                                 line_spacing=1.1, shadow=True)

    # Accent stripe
    stripe_w = int(cw * 0.25)
    sx = (W - stripe_w) // 2
    draw.rectangle([sx, ty + 10, sx + stripe_w, ty + 14], fill=(*T["accent1"], 255))
    ty += int(H * 0.032)

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.033), "italic")
        ty = draw_multiline_wrapped(draw, sub, sfont, pad, ty, cw,
                                     fill=(*T["text2"], 225), align="center")
        ty += int(H * 0.012)

    if desc := data.get("description"):
        dfont = get_font(int(H * 0.026), "regular")
        # Subtle card
        card_h = int(H * 0.18)
        draw.rounded_rectangle([pad, ty, W - pad, ty + card_h],
                                radius=16, fill=T["card"])
        draw.rounded_rectangle([pad, ty, pad + 6, ty + card_h],
                                radius=3, fill=(*T["accent1"], 255))
        draw_multiline_wrapped(draw, desc, dfont, pad + 20, ty + int(H * 0.02),
                                int(cw - 24), fill=(*T["text"], 215), align="left",
                                line_spacing=1.4)
        ty += card_h + int(H * 0.018)

    for bullet in data.get("bullets", []):
        bfont = get_font(int(H * 0.028), "regular")
        bh2 = text_size(draw, bullet, bfont)[1]
        dot_r = int(H * 0.007)
        draw_circle(draw, pad + dot_r + 4, ty + bh2 // 2, dot_r, fill=(*T["accent1"], 220))
        draw.text((pad + dot_r * 2 + 14, ty), bullet, font=bfont, fill=(*T["text2"], 215))
        ty += int(bh2 * 1.55)

    # Footer
    fy = H - int(H * 0.10)
    draw.rectangle([pad, fy, W - pad, fy + 2], fill=(*T["accent1"], 100))
    fy += int(H * 0.012)

    if contact := data.get("contact"):
        cfont = get_font(int(H * 0.026), "bold")
        draw.text((pad, fy), contact, font=cfont, fill=(*T["accent1"], 255))

    if htags := data.get("hashtags", []):
        hfont = get_font(int(H * 0.022), "regular")
        htext = "  ".join(str(h) for h in htags[:4])
        hw, _ = text_size(draw, htext, hfont)
        draw.text((W - pad - hw, fy), htext, font=hfont, fill=(*T["text3"], 200))

    if org := data.get("organizer"):
        ofont = get_font(int(H * 0.020), "italic")
        draw.text((pad, fy + int(H * 0.038)), org, font=ofont, fill=(*T["text3"], 170))

    return img.convert("RGB")


# ─── Certificate ──────────────────────────────────────────────────────────────

def render_certificate(data: dict, T: dict, W: int, H: int) -> Image.Image:
    # Override to elegant if not specifically set
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], T["bg3"])
    draw = ImageDraw.Draw(img, "RGBA")

    # Full outer frame with double border
    m1 = int(min(W, H) * 0.025)
    m2 = m1 + int(min(W, H) * 0.015)
    lw = max(3, int(min(W, H) * 0.004))
    draw.rectangle([m1, m1, W - m1, H - m1], outline=(*T["accent1"], 220), width=lw)
    draw.rectangle([m2, m2, W - m2, H - m2], outline=(*T["accent1"], 80), width=max(1, lw // 2))

    # Corner ornaments
    orn_size = int(min(W, H) * 0.06)
    for cx2, cy2 in [(m1, m1), (W - m1, m1), (m1, H - m1), (W - m1, H - m1)]:
        draw_polygon_shape(draw, cx2, cy2, 8, orn_size // 2,
                           rotation=math.pi / 8, fill=(*T["accent2"], 180))
        draw_polygon_shape(draw, cx2, cy2, 4, orn_size // 4,
                           rotation=math.pi / 4, fill=(*T["accent1"], 220))

    pad = int(W * 0.10)
    cw  = W - 2 * pad
    cy  = m2 + int(H * 0.045)

    # Logo
    if logo_b64 := data.get("logo_base64"):
        lh = int(H * 0.09)
        logo = load_image_b64(logo_b64)
        if logo:
            scale = lh / logo.height
            lw2 = int(logo.width * scale)
            logo = logo.resize((lw2, lh), Image.LANCZOS)
            img.paste(logo, ((W - lw2) // 2, cy), logo)
            draw = ImageDraw.Draw(img, "RGBA")
            cy += lh + int(H * 0.02)

    # "CERTIFICAT DE..." header
    hfont = get_font(int(H * 0.030), "bold")
    htxt = data.get("badge", "CERTIFICAT D'EXCELLENCE")
    draw_text_centered(draw, htxt, hfont, W // 2, cy, fill=(*T["accent1"], 255))
    cy += text_size(draw, htxt, hfont)[1] + int(H * 0.015)

    # Decorative divider
    div_cx = W // 2
    for i in range(5):
        r = int(min(W, H) * (0.006 - i * 0.001))
        if r > 0:
            col = T["accent1"] if i % 2 == 0 else T["accent2"]
            x_off = (i - 2) * int(W * 0.05)
            draw_circle(draw, div_cx + x_off, cy, r, fill=(*col, 200 - i * 30))
    draw.rectangle([pad + 60, cy, div_cx - int(W * 0.14), cy + 2],
                   fill=(*T["accent1"], 160))
    draw.rectangle([div_cx + int(W * 0.14), cy, W - pad - 60, cy + 2],
                   fill=(*T["accent1"], 160))
    cy += int(H * 0.028)

    # Title (large)
    tfont = get_font(int(H * 0.055), "bold")
    ty = draw_multiline_wrapped(draw, data.get("title", ""), tfont, pad, cy, cw,
                                 fill=(*T["text"], 255), align="center",
                                 line_spacing=1.1, shadow=True)
    cy = ty + int(H * 0.012)

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.030), "italic")
        cy = draw_multiline_wrapped(draw, sub, sfont, pad, cy, cw,
                                     fill=(*T["text2"], 225), align="center")
        cy += int(H * 0.010)

    draw.rectangle([pad + 80, cy + 5, W - pad - 80, cy + 7],
                   fill=(*T["accent1"], 80))
    cy += int(H * 0.028)

    if desc := data.get("description"):
        dfont = get_font(int(H * 0.027), "regular")
        cy = draw_multiline_wrapped(draw, desc, dfont, pad + 20, cy, cw - 40,
                                     fill=(*T["text"], 210), align="center",
                                     line_spacing=1.45)
        cy += int(H * 0.018)

    # Date + signature zone at bottom
    sig_y = H - m2 - int(H * 0.11)
    if d := data.get("date"):
        dfont2 = get_font(int(H * 0.024), "regular")
        dw, _ = text_size(draw, d, dfont2)
        draw.text(((W - dw) // 2, sig_y), d, font=dfont2, fill=(*T["text3"], 200))
        sig_y += int(H * 0.038)

    if org := data.get("organizer"):
        # Signature line left
        sig_lw = int(cw * 0.28)
        sig_lx = pad + int(cw * 0.08)
        draw.rectangle([sig_lx, sig_y, sig_lx + sig_lw, sig_y + 2],
                       fill=(*T["accent1"], 150))
        ofont = get_font(int(H * 0.020), "bold")
        ow, _ = text_size(draw, org, ofont)
        draw.text((sig_lx + (sig_lw - ow) // 2, sig_y + 6), org,
                   font=ofont, fill=(*T["text3"], 200))

    return img.convert("RGB")


# ─── Business card ────────────────────────────────────────────────────────────

def render_business_card(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], direction="horizontal")
    draw = ImageDraw.Draw(img, "RGBA")

    # Decorative circle top-right
    add_glow_circle(img, W - int(W * 0.12), -int(H * 0.2), int(H * 0.9), T["bg3"], 0.6)
    draw = ImageDraw.Draw(img, "RGBA")

    # Left accent bar
    bar = max(8, int(W * 0.008))
    draw.rectangle([0, 0, bar, H], fill=(*T["accent1"], 255))
    draw.rectangle([0, H - bar, W, H], fill=(*T["accent1"], 140))

    pad = int(H * 0.14)
    lx  = bar + pad

    logo_space = 0
    if logo_b64 := data.get("logo_base64"):
        lh = int(H * 0.55)
        logo_space = embed_logo(img, logo_b64, lx, (H - lh) // 2, lh, shadow=True)
        draw = ImageDraw.Draw(img, "RGBA")
        logo_space += int(H * 0.12)

    tx = lx + logo_space
    tw = W - tx - pad
    ty = pad

    name = data.get("title") or data.get("organizer") or data.get("brand_name") or ""
    if name:
        nfont = get_font(int(H * 0.22), "bold")
        draw.text((tx, ty), name, font=nfont, fill=(*T["text"], 255))
        ty += text_size(draw, name, nfont)[1] + int(H * 0.06)

    if sub := data.get("subtitle") or data.get("brand_name"):
        sfont = get_font(int(H * 0.14), "regular")
        draw.text((tx, ty), sub, font=sfont, fill=(*T["accent1"], 255))
        ty += text_size(draw, sub, sfont)[1] + int(H * 0.05)

    draw.rectangle([tx, ty, tx + int(tw * 0.5), ty + 2], fill=(*T["accent1"], 200))
    ty += int(H * 0.08)

    for item in [data.get("contact"), data.get("location"), data.get("date")]:
        if item:
            ifont = get_font(int(H * 0.12), "regular")
            draw.text((tx, ty), item, font=ifont, fill=(*T["text2"], 220))
            ty += text_size(draw, item, ifont)[1] + int(H * 0.05)

    return img.convert("RGB")


# ─── Ticket ───────────────────────────────────────────────────────────────────

def render_ticket(data: dict, T: dict, W: int, H: int) -> Image.Image:
    img = make_gradient_bg(W, H, T["bg1"], T["bg2"], direction="horizontal")
    draw = ImageDraw.Draw(img, "RGBA")

    stub_x = int(W * 0.72)
    pad    = int(H * 0.10)
    bottom_limit = H - int(H * 0.10)  # ne pas dessiner en dessous de cette limite

    # ── Bande d'accentuation verticale gauche ──
    draw.rectangle([0, 0, int(W * 0.005), H], fill=(*T["accent1"], 255))

    # ── Séparateur souche cranté ──
    teeth = 18
    th = H // teeth
    for i in range(teeth):
        y0 = i * th
        if i % 2 == 0:
            draw.ellipse([stub_x - 14, y0 + 1, stub_x + 14, y0 + th - 1],
                         fill=(*T["bg1"][:3], 255))
        # Ligne pointillée verticale
        if i % 2 == 1:
            draw.line([(stub_x, y0), (stub_x, y0 + th)], fill=(*T["accent1"], 60), width=1)

    # ── Section principale gauche ──
    cw    = stub_x - pad - int(W * 0.01)
    cy    = pad

    # Logo + brand en ligne horizontale
    has_logo = bool(data.get("logo_base64"))
    logo_h   = int(H * 0.18)
    brand_x  = pad

    if has_logo:
        embed_logo(img, data["logo_base64"], pad, cy, logo_h, shadow=False)
        draw = ImageDraw.Draw(img, "RGBA")
        brand_x = pad + logo_h + int(W * 0.012)

    if brand := data.get("brand_name"):
        bfont = get_font(int(H * 0.13), "bold")
        _, bh  = text_size(draw, brand, bfont)
        by     = cy + (logo_h - bh) // 2 if has_logo else cy
        draw.text((brand_x, by), brand, font=bfont, fill=(*T["accent1"], 255))

    cy = pad + (logo_h if has_logo else int(H * 0.04)) + int(H * 0.06)

    # Titre — police réduite pour tenir en 2 lignes max dans la largeur disponible
    tfont_size = int(H * 0.155)
    tfont = get_font(tfont_size, "bold")
    # Réduit auto la police si le titre est très long
    title_str = data.get("title", "")
    while tfont_size > int(H * 0.09) and text_size(draw, title_str, tfont)[0] > cw * 1.8:
        tfont_size -= 4
        tfont = get_font(tfont_size, "bold")

    cy = draw_multiline_wrapped(draw, title_str, tfont, pad, cy, cw,
                                fill=(*T["text"], 255), align="left",
                                line_spacing=1.08, shadow=True,
                                max_lines=2, max_y=bottom_limit - int(H * 0.35))
    cy += int(H * 0.03)

    if sub := data.get("subtitle"):
        sfont = get_font(int(H * 0.085), "italic")
        cy = draw_multiline_wrapped(draw, sub, sfont, pad, cy, cw,
                                    fill=(*T["text2"], 200), align="left",
                                    max_lines=1, max_y=bottom_limit - int(H * 0.28))
        cy += int(H * 0.02)

    # Séparateur accent
    draw.rectangle([pad, cy, pad + int(cw * 0.55), cy + 2], fill=(*T["accent1"], 200))
    cy += int(H * 0.05)

    # Date + heure sur une ligne, puis lieu seul
    date_str = data.get("date", "")
    time_str = data.get("time", "")
    loc_str  = data.get("location", "")

    ifont  = get_font(int(H * 0.095), "regular")
    ifont2 = get_font(int(H * 0.085), "regular")

    if date_str or time_str:
        dt_line = "  |  ".join(filter(None, [date_str, time_str]))
        if cy + text_size(draw, dt_line, ifont)[1] < bottom_limit - 4:
            draw.text((pad, cy), dt_line, font=ifont, fill=(*T["text2"], 230))
            cy += text_size(draw, dt_line, ifont)[1] + int(H * 0.025)

    if loc_str and cy + text_size(draw, loc_str, ifont2)[1] < bottom_limit - 4:
        # Tronquer si trop long
        max_loc_w = cw - int(W * 0.01)
        while loc_str and text_size(draw, loc_str + "...", ifont2)[0] > max_loc_w:
            loc_str = loc_str[:-1]
        if len(loc_str) < len(data.get("location", "")):
            loc_str += "..."
        draw.text((pad, cy), loc_str, font=ifont2, fill=(*T["text2"], 200))
        cy += text_size(draw, loc_str, ifont2)[1] + int(H * 0.02)

    # ── Stub droit ──
    sx = stub_x + int(W * 0.018)
    sw = W - sx - int(pad * 0.5)
    stub_center_y = H // 2

    # Badge (VIP, GRATUIT…) en haut du stub
    if badge := data.get("badge"):
        bfont = get_font(int(H * 0.10), "bold")
        bw2, bh2 = draw_badge(draw, badge, bfont, 0, 0, T["badge_bg"], T["badge_text"], 8, 10)
        draw_badge(draw, badge, bfont,
                   sx + (sw - bw2) // 2, int(H * 0.10),
                   T["badge_bg"], T["badge_text"], 8, 10)

    # Prix (valeur principale du stub)
    if price := data.get("price"):
        # Réduire police si prix long
        pfsize = int(H * 0.14)
        pfont  = get_font(pfsize, "bold")
        while pfsize > int(H * 0.08) and text_size(draw, price, pfont)[0] > sw - 10:
            pfsize -= 3
            pfont = get_font(pfsize, "bold")
        pw, ph = text_size(draw, price, pfont)
        draw.text((sx + (sw - pw) // 2, stub_center_y - ph // 2 - int(H * 0.04)),
                   price, font=pfont, fill=(*T["accent1"], 255))
        # Label "PRIX"
        lbfont = get_font(int(H * 0.07), "regular")
        lbw, _ = text_size(draw, "PRIX", lbfont)
        draw.text((sx + (sw - lbw) // 2, stub_center_y - ph // 2 - int(H * 0.12)),
                   "PRIX", font=lbfont, fill=(*T["text3"], 160))

    # Numéro de billet (bottom stub)
    tn = data.get("contact") or "#001"
    tnfont = get_font(int(H * 0.085), "regular")
    tnw, tnh = text_size(draw, tn, tnfont)
    draw.text((sx + (sw - tnw) // 2, H - int(H * 0.18)),
               tn, font=tnfont, fill=(*T["text3"], 190))
    # Micro-label "N° BILLET"
    nbfont = get_font(int(H * 0.06), "regular")
    nbw, _ = text_size(draw, "N BILLET", nbfont)
    draw.text((sx + (sw - nbw) // 2, H - int(H * 0.26)),
               "N BILLET", font=nbfont, fill=(*T["text3"], 120))

    # Barres accent haut/bas
    bar_h = max(4, int(H * 0.014))
    draw.rectangle([0, 0, W, bar_h], fill=(*T["accent1"], 255))
    draw.rectangle([0, H - bar_h, W, H], fill=(*T["accent1"], 255))

    return img.convert("RGB")


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
    "attestation":   render_certificate,
    "business_card": render_business_card,
    "carte_visite":  render_business_card,
    "ticket":        render_ticket,
    "billet":        render_ticket,
}


def get_theme(name: str) -> dict:
    return THEMES.get(name.lower(), THEMES[DEFAULT_THEME])


def generate_visual(data: dict[str, Any]) -> bytes:
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow non installé. Lancez : pip install Pillow")

    vtype     = data.get("visual_type", "poster").lower()
    fmt_name  = data.get("format", "portrait").lower()
    theme_nm  = data.get("theme", DEFAULT_THEME).lower()
    out_fmt   = data.get("output_format", "png").lower()
    quality   = int(data.get("quality", 92))

    W, H = FORMATS.get(fmt_name, FORMATS["portrait"])
    T    = get_theme(theme_nm).copy()

    # Override accent color with brand_color if provided
    if bc := data.get("brand_color"):
        try:
            T["accent1"] = hex_to_rgb(bc)
        except Exception:
            pass

    renderer = RENDERERS.get(vtype, render_poster)
    img = renderer(data, T, W, H)

    # Final polish: slight sharpening for crispness
    try:
        from PIL import ImageFilter
        img = img.filter(ImageFilter.SHARPEN)
    except Exception:
        pass

    buf = io.BytesIO()
    if out_fmt in ("jpg", "jpeg"):
        img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    else:
        img.save(buf, format="PNG", optimize=True)

    return buf.getvalue()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        raw  = sys.stdin.buffer.read()
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
