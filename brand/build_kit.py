"""Generates the Paivo logo masters as filled outlines (no strokes, no text). Run: python brand/build_kit.py"""
import math, pathlib
OUT = pathlib.Path(__file__).parent / "logo"
INDIGO, VIOLET, INK, DARK = "#6366F1", "#8B5CF6", "#0B1020", "#070A13"
g = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")

def p_open(sw=38, r=54, gap=20, sx=69, ty=44, cx=133, bot=212):
    h = sw/2; cy = ty + r; R = r+h; ri = r-h
    a = math.radians(90-gap); ca, sa = math.cos(a), math.sin(a)
    o = (cx+R*ca, cy+R*sa); i = (cx+ri*ca, cy+ri*sa)
    return (f"M{g(sx-h)} {bot}V{ty}A{g(h)} {g(h)} 0 0 1 {sx} {g(ty-h)}H{cx}A{g(R)} {g(R)} 0 0 1 {g(o[0])} {g(o[1])}"
            f"A{g(h)} {g(h)} 0 0 1 {g(i[0])} {g(i[1])}A{g(ri)} {g(ri)} 0 0 0 {cx} {g(ty+h)}H{g(sx+h)}V{bot}"
            f"A{g(h)} {g(h)} 0 0 1 {g(sx-h)} {bot}Z")
def p_closed(sw=38, r=54, sx=69, ty=44, cx=133, bot=212):
    h = sw/2; cy = ty + r; R = r+h; ri = r-h
    return (f"M{g(sx-h)} {bot}V{ty}A{g(h)} {g(h)} 0 0 1 {sx} {g(ty-h)}H{cx}A{g(R)} {g(R)} 0 0 1 {cx} {g(cy+R)}H{g(sx+h)}V{bot}"
            f"A{g(h)} {g(h)} 0 0 1 {g(sx-h)} {bot}ZM{g(sx+h)} {g(ty+h)}H{cx}A{g(ri)} {g(ri)} 0 0 1 {cx} {g(cy+ri)}H{g(sx+h)}Z")
def pill(x1, y1, x2, y2, w):
    h = w/2; dx, dy = x2-x1, y2-y1; L = math.hypot(dx, dy); nx, ny = -dy/L*h, dx/L*h
    return (f"M{g(x1+nx)} {g(y1+ny)}L{g(x2+nx)} {g(y2+ny)}A{g(h)} {g(h)} 0 0 0 {g(x2-nx)} {g(y2-ny)}"
            f"L{g(x1-nx)} {g(y1-ny)}A{g(h)} {g(h)} 0 0 0 {g(x1+nx)} {g(y1+ny)}Z")
def ring(cx, cy, r, w):
    R, ri = r+w/2, r-w/2
    return (f"M{g(cx-R)} {cy}A{g(R)} {g(R)} 0 1 0 {g(cx+R)} {cy}A{g(R)} {g(R)} 0 1 0 {g(cx-R)} {cy}Z"
            f"M{g(cx-ri)} {cy}A{g(ri)} {g(ri)} 0 1 1 {g(cx+ri)} {cy}A{g(ri)} {g(ri)} 0 1 1 {g(cx-ri)} {cy}Z")
def dot(cx, cy, r): return f"M{g(cx-r)} {cy}A{r} {r} 0 1 0 {g(cx+r)} {cy}A{r} {r} 0 1 0 {g(cx-r)} {cy}Z"

W = 26  # wordmark stroke
# "paivo": the p IS the open-loop mark at x-height (same open gap as A1) with a descending stem; "aivo" are monoline shapes.
P_WORD = p_open(sw=W, r=40, gap=20, sx=0, ty=100, cx=44, bot=232)
word_rings = [ring(168,140,40,W), ring(464,140,40,W)]                                   # a, o
word_stems = [pill(208,100,208,180,W), pill(252,100,252,180,W), pill(300,100,340,180,W), pill(340,180,380,100,W)]  # a stem, i, v
word_dot = dot(252, 62, 15)
WORD_X0, WORD_X1, WORD_Y0, WORD_Y1 = -13, 517, 47, 245   # ink bounds of the wordmark
WORD_VB = f"{WORD_X0-4} {WORD_Y0-4} {WORD_X1-WORD_X0+8} {WORD_Y1-WORD_Y0+8}"   # -17 43 538 206

def svg(vb, body, title, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-labelledby="t"><title id="t">{title}</title>'
            f'{defs}{body}</svg>\n')
GRAD = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{INDIGO}"/>'
        f'<stop offset="1" stop-color="{VIOLET}"/></linearGradient></defs>')
def mark(d, fill): return f'<path d="{d}" fill="{fill}"/>'
def word(ink, dotc, pfill):
    return (f'<path d="{P_WORD}" fill="{pfill}"/><path fill-rule="evenodd" d="{"".join(word_rings)}" fill="{ink}"/>'
            f'<path d="{"".join(word_stems)}" fill="{ink}"/><path d="{word_dot}" fill="{dotc}"/>')

OPEN, CLOSED, SMALL = p_open(), p_closed(), p_open(sw=46, gap=30)
def write(name, s): (OUT/name).write_text(s, encoding="utf-8")
for old in list(OUT.glob("paivo-horizontal*")) + list(OUT.glob("paivo-stacked*")): old.unlink()   # superseded: the mark beside the wordmark read as "Ppaivo"

# symbols (icon uses: favicon, app icons, pay-page footer, paid animation)
for tag, d in (("", OPEN), ("-closed", CLOSED), ("-small", SMALL)):
    write(f"paivo-symbol{tag}.svg", svg("0 0 256 256", mark(d, "url(#g)"), "Paivo", GRAD))
    write(f"paivo-symbol{tag}-black.svg", svg("0 0 256 256", mark(d, "#000"), "Paivo"))
    write(f"paivo-symbol{tag}-white.svg", svg("0 0 256 256", mark(d, "#fff"), "Paivo"))
write("paivo-symbol-indigo.svg", svg("0 0 256 256", mark(OPEN, INDIGO), "Paivo"))

# primary logo: the wordmark (no separate symbol beside it)
write("paivo-wordmark.svg", svg(WORD_VB, word(INK, VIOLET, "url(#g)"), "Paivo", GRAD))
write("paivo-wordmark-dark.svg", svg(WORD_VB, word("#fff", VIOLET, "url(#g)"), "Paivo", GRAD))
write("paivo-wordmark-black.svg", svg(WORD_VB, word("#000", "#000", "#000"), "Paivo"))
write("paivo-wordmark-white.svg", svg(WORD_VB, word("#fff", "#fff", "#fff"), "Paivo"))
write("paivo-wordmark-indigo.svg", svg(WORD_VB, word(INDIGO, INDIGO, INDIGO), "Paivo"))

# app tile (favicon / app icon source): gradient tile + white small-cut P, optically centred
tile = (f'<rect width="256" height="256" rx="56" fill="url(#g)"/><g transform="translate(25.6 22) scale(0.8)">{mark(SMALL, "#fff")}</g>')
write("paivo-app-tile.svg", svg("0 0 256 256", tile, "Paivo", GRAD))
print("wrote", sorted(p.name for p in OUT.iterdir()))

# --- social: link preview (1200x630, dark) --- render with render_png.py (the tagline is live text: ship the PNG)
import re as _re
def _inner(name):
    return _re.sub(r'<svg[^>]*>|</svg>|<title[^>]*>.*?</title>', '', (OUT/name).read_text(encoding="utf-8"), flags=_re.S)
_vw, _vh = WORD_X1 - WORD_X0 + 8, WORD_Y1 - WORD_Y0 + 8
_sc = 740 / _vw
_og = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="{DARK}"/>'
       f'<g transform="translate({600 - _vw*_sc/2 - (WORD_X0-4)*_sc:.1f} {250 - _vh*_sc/2 - (WORD_Y0-4)*_sc:.1f}) scale({_sc:.4f})">{_inner("paivo-wordmark-dark.svg")}</g>'
       f'<text x="600" y="470" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="32" fill="#A9B0C6">Your client pays by UPI. Your files unlock when they do.</text></svg>')
(OUT.parent/"social"/"og-image.svg").write_text(_og, encoding="utf-8")

# --- social: "Powered by Paivo" badge for light backgrounds (invoice PDFs, emails) ---
_h = 22; _s = _h / _vh
(OUT.parent/"social"/"powered-by-paivo.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {64 + _vw*_s:.0f} 30"><text x="0" y="20" font-family="Segoe UI,Arial,sans-serif" font-size="12" fill="#6B7280">Powered by</text>'
    f'<g transform="translate({64 - (WORD_X0-4)*_s:.2f} {4 - (WORD_Y0-4)*_s:.2f}) scale({_s:.4f})">{_inner("paivo-wordmark.svg")}</g></svg>', encoding="utf-8")
