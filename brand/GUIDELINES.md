# Paivo logo: one-page guide

**Idea:** a P whose bowl stays open until the money arrives. Unpaid = open, paid = closed (`paivo-symbol-closed.svg`).

## Files (`logo/`, all SVG, filled outlines, no live text, regenerate with `python brand/build_kit.py`)
| Use | File |
|---|---|
| Default, on white | `paivo-horizontal.svg` |
| On dark (#070A13) | `paivo-horizontal-dark.svg` |
| Stacked (square-ish spaces) | `paivo-stacked.svg`, `-dark` |
| Symbol only | `paivo-symbol.svg` (open), `paivo-symbol-closed.svg` |
| 16-24 px (favicon, tabs) | `paivo-symbol-small.svg` (thicker stroke, wider gap) |
| One colour | `*-black`, `*-white`, `*-indigo` |
| Icons | `icons/` (favicon.ico/.svg, 16-512 px PNG, apple-touch-icon) |
| Link preview (WhatsApp, LinkedIn) | `social/og-image.png` (1200x630) |
| Invoice PDF footer | `social/powered-by-paivo.svg/.png` |
| Pay-page animation | `animation/` |

## Colour
Indigo `#6366F1` (99,102,241) to violet `#8B5CF6` (139,92,246), diagonal gradient on the symbol only. Ink `#0B1020`, dark background `#070A13`.
The "i" dot is always violet in colour versions. Print values (CMYK/Pantone) are not set: proof before ordering print.

## Rules
- Clear space: keep at least the width of the P stem (about 1/6 of the symbol height) free on all sides.
- Minimum size: symbol 16 px (use the small cut below 32 px); horizontal lockup 80 px wide; stacked 64 px wide.
- On brand-colour or photo backgrounds use the white version, never the gradient.
- Don't stretch, rotate, outline, recolour outside the palette, add effects, or close the gap in the open symbol (the closed one is its own file).
- Open/closed states are only a visual of invoice status. They never change it (AGENTS.md rule 1).

## Open items
- Wordmark letters are constructed from geometric shapes, not a licensed typeface: fine to use, but have a type designer refine the spacing if the brand grows.
- No trademark search done. Check the Indian trademark register (classes 9, 36, 42) and reverse-image search before printing at scale.
- Not yet wired into the site: `public/` favicon, `index.html` meta, header, and the PDF template still use the old assets. `og-image.svg` contains live text (rasterised PNG is the shippable file).
- The mark reads as "d" when rotated 180 degrees and "q" when mirrored; harmless, but don't use it rotated.
