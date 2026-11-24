import math, pathlib
here = pathlib.Path(__file__).parent
SW = 38
def pt(deg, cx=138, cy=100, r=54):
    a = math.radians(deg); return cx + r*math.cos(a), cy + r*math.sin(a)
f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
# angles: 0 = 3 o'clock, 90 = 6 o'clock (screen coords, clockwise positive)
top = "M74 214V46H138"
# V1: wider gap - bowl ends 35 deg before the bottom, well clear of the stem
x, y = pt(90-20)
v1 = f"{top}A54 54 0 0 1 {f(x)} {f(y)}"
# V2: loop about to close - ring attached to stem, break at lower right
e1 = pt(-52); e2 = pt(42)
v2 = f"{top}A54 54 0 0 1 {f(e1[0])} {f(e1[1])}M74 154H138A54 54 0 0 0 {f(e2[0])} {f(e2[1])}"
# V3: same path, open vs closed
v3_open = v1
v3_closed = f"{top}A54 54 0 0 1 138 154H74"
def svg(d, cls=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="{d}" fill="none" stroke="#000" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 0)"/></svg>'
for n, d in [("a1-wide-gap", v1), ("a2-closing", v2), ("a3-open", v3_open), ("a3-closed", v3_closed)]:
    (here/f"{n}.svg").write_text(svg(d))
def sym(id_, d):
    return f'<symbol id="{id_}" viewBox="0 0 256 256"><path d="{d}" fill="none" stroke="currentColor" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round" transform="translate(-6 0)"/></symbol>'
syms = "".join(sym(i, d) for i, d in [("v1", v1), ("v2", v2), ("vo", v3_open), ("vc", v3_closed)])
def use(id_, s): return f'<svg width="{s}" height="{s}"><use href="#{id_}"/></svg>'
def row(ids, bg, fg):
    cells = ""
    for i in ids:
        cells += f'<div class="mk">{use(i,150)}</div>'
    small = ""
    for i in ids:
        small += '<div class="sm">' + "".join(use(i,s) for s in (64,32,16)) + '</div>'
    return f'<div class="panel" style="background:{bg};color:{fg}"><div class="big">{cells}</div><div class="smalls">{small}</div></div>'
cards = [
 ("A1 · Wider gap", "Bowl stops short of the stem. Clear opening, still one shape.", ["v1"]),
 ("A2 · Closing", "Ring attached to the stem with a break on the right side: a loop about to close.", ["v2"]),
 ("A3 · Open → Closed", "Same mark, unpaid then paid. Closed is a plain P. One path, animate the bowl closing.", ["vo","vc"]),
]
html = f'''<!doctype html><meta charset="utf-8"><style>
body{{margin:0;background:#f6f6f3;font-family:Segoe UI,Arial,sans-serif;color:#111;width:1600px}}
h1{{font-size:34px;margin:36px 60px 4px}} .sub{{margin:0 60px 24px;color:#666;font-size:17px}}
.cols{{display:flex;gap:28px;margin:0 60px 40px}}
.card{{flex:1;background:#fff;border:1px solid #e4e4e0;border-radius:18px;padding:20px}}
.card h2{{margin:0 0 4px;font-size:22px}} .card p{{margin:0 0 14px;color:#555;font-size:15px;min-height:40px}}
.panel{{border-radius:12px;padding:18px;margin-bottom:12px;border:1px solid #e4e4e0}}
.big{{display:flex;gap:24px;justify-content:center;align-items:center;height:170px}}
.smalls{{display:flex;gap:30px;justify-content:center;align-items:flex-end;margin-top:10px;font-size:11px}}
.sm{{display:flex;gap:12px;align-items:flex-end}} .mk{{display:flex}}
</style><svg width="0" height="0" style="position:absolute">{syms}</svg>
<h1>Concept A: variations</h1><p class="sub">Black on white and white on #070a13. Sizes 64 / 32 / 16 px. Colour comes after you pick.</p>
<div class="cols">''' + "".join(
 f'<div class="card"><h2>{t}</h2><p>{d}</p>{row(ids,"#fff","#000")}{row(ids,"#070a13","#fff")}</div>' for t,d,ids in cards) + '</div>'
(here/"sheet.html").write_text(html, encoding="utf-8")
