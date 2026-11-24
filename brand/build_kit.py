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
word_ink = [ring(40,140,40,W), ring(164,140,40,W), ring(460,140,40,W),
            pill(0,100,0,232,W), pill(204,100,204,180,W), pill(248,100,248,180,W),
            pill(296,100,336,180,W), pill(336,180,376,100,W)]
word_dot = dot(248, 62, 15)
WORD_X0, WORD_X1, WORD_Y0, WORD_Y1 = -13, 513, 47, 245   # ink bounds of the wordmark

def svg(vb, body, title, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-labelledby="t"><title id="t">{title}</title>'
            f'{defs}{body}</svg>\n')
GRAD = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{INDIGO}"/>'
        f'<stop offset="1" stop-color="{VIOLET}"/></linearGradient></defs>')
def mark(d, fill): return f'<path d="{d}" fill="{fill}"/>'
def word(ink, dotc):
    return (f'<path fill-rule="evenodd" d="{"".join(p for p in word_ink[:3])}" fill="{ink}"/>'
            f'<path d="{"".join(word_ink[3:])}" fill="{ink}"/><path d="{word_dot}" fill="{dotc}"/>')

OPEN, CLOSED, SMALL = p_open(), p_closed(), p_open(sw=46, gap=30)
def write(name, s): (OUT/name).write_text(s, encoding="utf-8")

# symbols
for tag, d in (("", OPEN), ("-closed", CLOSED), ("-small", SMALL)):
    write(f"paivo-symbol{tag}.svg", svg("0 0 256 256", mark(d, "url(#g)"), "Paivo", GRAD))
    write(f"paivo-symbol{tag}-black.svg", svg("0 0 256 256", mark(d, "#000"), "Paivo"))
    write(f"paivo-symbol{tag}-white.svg", svg("0 0 256 256", mark(d, "#fff"), "Paivo"))

# horizontal lockup: symbol 256 tall, wordmark beside it
GAP = 36; WS = 1.0; wy = 128 - (WORD_Y0+WORD_Y1)/2
wx = 256 - 64 + GAP - WORD_X0      # symbol ink ends ~x=210 (outer bowl), so start after that
hw = int(wx + WORD_X1 + 8)
def horizontal(mk, ink, dotc, defs=""):
    return svg(f"38 0 {hw-38} 256", mk + f'<g transform="translate({g(wx)} {g(wy)})">{word(ink, dotc)}</g>', "Paivo", defs)
write("paivo-horizontal.svg", horizontal(mark(OPEN, "url(#g)"), INK, VIOLET, GRAD))
write("paivo-horizontal-dark.svg", horizontal(mark(OPEN, "url(#g)"), "#fff", VIOLET, GRAD))
write("paivo-horizontal-black.svg", horizontal(mark(OPEN, "#000"), "#000", "#000"))
write("paivo-horizontal-white.svg", horizontal(mark(OPEN, "#fff"), "#fff", "#fff"))

# stacked lockup
ww = WORD_X1 - WORD_X0; sw_ = 400
def stacked(ink, dotc, mk_fill, defs=""):
    W_ = ww + 80; sc = 0.9
    mk = f'<g transform="translate({g(W_/2-128*sc)} 0) scale({sc})">{mark(OPEN, mk_fill)}</g>'
    w = f'<g transform="translate({g(W_/2 - (WORD_X0+WORD_X1)/2)} {g(256*sc+24-WORD_Y0)})">{word(ink, dotc)}</g>'
    H = 256*sc + 24 + (WORD_Y1-WORD_Y0) + 22
    return svg(f"0 0 {g(W_)} {g(H)}", mk + w, "Paivo", defs)
write("paivo-symbol-indigo.svg", svg("0 0 256 256", mark(OPEN, INDIGO), "Paivo"))
write("paivo-horizontal-indigo.svg", horizontal(mark(OPEN, INDIGO), INDIGO, INDIGO))
write("paivo-stacked.svg", stacked(INK, VIOLET, "url(#g)", GRAD))
write("paivo-stacked-dark.svg", stacked("#fff", VIOLET, "url(#g)", GRAD))
write("paivo-wordmark.svg", svg(f"{WORD_X0-8} {WORD_Y0-8} {ww+16} {WORD_Y1-WORD_Y0+16}", word(INK, VIOLET), "Paivo"))

# app tile (favicon / app icon source): gradient tile + white small-cut P, optically centred
tile = (f'<rect width="256" height="256" rx="56" fill="url(#g)"/><g transform="translate(25.6 22) scale(0.8)">{mark(SMALL, "#fff")}</g>')
write("paivo-app-tile.svg", svg("0 0 256 256", tile, "Paivo", GRAD))
print("wrote", sorted(p.name for p in OUT.iterdir()))
