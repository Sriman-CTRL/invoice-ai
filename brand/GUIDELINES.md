# Paivo logo: one-page guide

**Primary logo: the wordmark "paivo"**, whose first letter is the open-loop mark (a p whose bowl stays open). It stands alone; don't put the symbol beside it (a P next to "paivo" reads as "Ppaivo").
**The standalone mark** (a P whose bowl stays open until the money arrives) is for icon uses only: favicon, app icons, the "Powered by" credit on the pay page, and the paid animation. Unpaid = open, paid = closed (`paivo-symbol-closed.svg`).

## Files (`logo/`, all SVG, filled outlines, no live text; regenerate with `python brand/build_kit.py`)
| Use | File |
|---|---|
| Default logo, on white | `paivo-wordmark.svg` |
| On dark (#070A13) | `paivo-wordmark-dark.svg` |
| One colour | `paivo-wordmark-black / -white / -indigo.svg` |
| Mark only (icon uses) | `paivo-symbol.svg` (open), `paivo-symbol-closed.svg` |
| Mark at 16-24 px (favicon, tabs) | `paivo-symbol-small.svg` (thicker stroke, wider gap) |
| One-colour mark | `paivo-symbol*-black / -white / -indigo` |
| Icons | `icons/` (favicon.ico/.svg, 16-512 px PNG, apple-touch-icon); `logo/paivo-app-tile.svg`, `paivo-app-maskable.svg` |
| Link preview (WhatsApp, LinkedIn) | `social/og-image.png` (1200x630) |
| Invoice PDF / email footer | `social/powered-by-paivo.svg/.png` |
| Pay-page animation | `animation/` |

## Colour
Indigo `#6366F1` (99,102,241) to violet `#8B5CF6` (139,92,246), diagonal gradient on the p of the wordmark and on the mark. "aivo" is ink `#0B1020` (white on dark). Dark background `#070A13`.
The i-dot is always violet in colour versions. Print values (CMYK/Pantone) are not set: proof before ordering print.

## Rules
- Minimum size: wordmark 24 px tall (about 63 px wide); below that use the mark alone (`paivo-symbol-small.svg`, 16 px minimum).
- Clear space: keep at least the height of the "a" free on all sides of the wordmark.
- On brand-colour or photo backgrounds use the white version, never the gradient.
- Don't stretch, rotate, outline, recolour outside the palette, add effects, or close the gap in the p (the closed mark is its own file, used for the paid state only).
- Open/closed states are only a visual of invoice status. They never change it (AGENTS.md rule 1).
- There is no stacked or "symbol + wordmark" lockup on purpose.

## Open items
- Wordmark letters are constructed from geometric shapes, not a licensed typeface: fine to use, but have a type designer refine the spacing if the brand grows.
- No trademark search done. Check the Indian trademark register (classes 9, 36, 42) and reverse-image search before printing at scale.
- The mark reads as "d" when rotated 180 degrees and "q" when mirrored; harmless, but don't use it rotated.
