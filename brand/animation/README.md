# Open → closed animation

`paivo-open-to-closed.svg` loops the mark from "unpaid" (bowl open) to "paid" (bowl closed). It is a demo of the effect.

For the pay page, don't loop it. Render the open state while the invoice is unpaid and run the closing once when the payment is confirmed:
the stroke of one path goes from `stroke-dasharray="822 1000"` to `"1000 1000"` (`pathLength="1000"`, a 400 ms ease-out works).
Show the final frame as-is, and use `prefers-reduced-motion` to jump straight to the closed state.
Static states are in `../logo/paivo-symbol.svg` (open) and `../logo/paivo-symbol-closed.svg` (closed).
Money state still comes only from a SUCCEEDED payment (AGENTS.md rule 1); the animation only reflects it.
