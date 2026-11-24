import { useId } from "react";

/**
 * Paivo logo as inline SVG (no extra requests, so CSP stays unchanged). Source of truth: brand/build_kit.py
 * (the path data below is copied from its output). The mark is a P whose bowl stays open until the money
 * arrives: "open" = unpaid, "closed" = paid. The open/closed state is only a picture of the invoice status;
 * it never decides it (AGENTS.md rule 1).
 */
const OPEN = "M50 212V44A19 19 0 0 1 69 25H133A73 73 0 0 1 157.97 166.6A19 19 0 0 1 144.97 130.89A35 35 0 0 0 133 63H88V212A19 19 0 0 1 50 212Z";
const SMALL = "M46 212V44A23 23 0 0 1 69 21H133A77 77 0 0 1 171.5 164.68A23 23 0 0 1 148.5 124.85A31 31 0 0 0 133 67H92V212A23 23 0 0 1 46 212Z";
const CLOSED = "M50 212V44A19 19 0 0 1 69 25H133A73 73 0 0 1 133 171H88V212A19 19 0 0 1 50 212ZM88 63H133A35 35 0 0 1 133 133H88Z";
const WORD_RINGS = "M-13 140A53 53 0 1 0 93 140A53 53 0 1 0 -13 140ZM13 140A27 27 0 1 1 67 140A27 27 0 1 1 13 140ZM111 140A53 53 0 1 0 217 140A53 53 0 1 0 111 140ZM137 140A27 27 0 1 1 191 140A27 27 0 1 1 137 140ZM407 140A53 53 0 1 0 513 140A53 53 0 1 0 407 140ZM433 140A27 27 0 1 1 487 140A27 27 0 1 1 433 140Z";
const WORD_STEMS = "M-13 100L-13 232A13 13 0 0 0 13 232L13 100A13 13 0 0 0 -13 100ZM191 100L191 180A13 13 0 0 0 217 180L217 100A13 13 0 0 0 191 100ZM235 100L235 180A13 13 0 0 0 261 180L261 100A13 13 0 0 0 235 100ZM284.37 105.81L324.37 185.81A13 13 0 0 0 347.63 174.19L307.63 94.19A13 13 0 0 0 284.37 105.81ZM347.63 185.81L387.63 105.81A13 13 0 0 0 364.37 94.19L324.37 174.19A13 13 0 0 0 347.63 185.81Z";
const WORD_DOT = "M233 62A15 15 0 1 0 263 62A15 15 0 1 0 233 62Z";
/** Centre line of the P, used by the closing animation (stroke 38). 822 of 1000 = the open state. */
const CENTRE_LINE = "M69 212V44H133A54 54 0 0 1 133 152H69";

const MARK_VIEWBOX = "39 14 184 228"; // tight around the P so it fills its box
const MARK_RATIO = 184 / 228;
const INDIGO = "#6366F1";
const VIOLET = "#8B5CF6";

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={INDIGO} />
        <stop offset="1" stopColor={VIOLET} />
      </linearGradient>
    </defs>
  );
}

type MarkProps = {
  /** Height in px. Below 24 px the thicker small-size cut is used automatically. */
  size?: number;
  state?: "open" | "closed";
  /** "gradient" = brand colours; "current" = one colour taken from the surrounding text colour. */
  tone?: "gradient" | "current";
  className?: string;
};

export function PaivoMark({ size = 32, state = "open", tone = "gradient", className }: MarkProps) {
  const gid = useId();
  const d = state === "closed" ? CLOSED : size < 24 ? SMALL : OPEN;
  return (
    <svg viewBox={MARK_VIEWBOX} height={size} width={size * MARK_RATIO} className={className} aria-hidden="true" focusable="false">
      {tone === "gradient" && <Gradient id={gid} />}
      <path d={d} fill={tone === "gradient" ? `url(#${gid})` : "currentColor"} />
    </svg>
  );
}

/** Mark + wordmark. The wordmark takes the surrounding text colour (use text-white on dark, text-slate-900 on light). */
export function PaivoLogo({ height = 32, className }: { height?: number; className?: string }) {
  const gid = useId();
  const small = height < 24;
  return (
    <svg viewBox="38 0 724 256" height={height} width={(height * 724) / 256} className={className} role="img" aria-label="Paivo" focusable="false">
      <Gradient id={gid} />
      <path d={small ? SMALL : OPEN} fill={`url(#${gid})`} />
      <g transform="translate(241 -18)">
        <path fillRule="evenodd" d={WORD_RINGS} fill="currentColor" />
        <path d={WORD_STEMS} fill="currentColor" />
        <path d={WORD_DOT} fill={VIOLET} />
      </g>
    </svg>
  );
}

/**
 * The bowl closes once when it first renders. With prefers-reduced-motion (or no CSS animation support) it
 * simply shows the closed mark. Purely visual: render it only where the page already shows the paid state.
 */
export function PaivoMarkClosing({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} height={size} width={size * MARK_RATIO} className={className} aria-hidden="true" focusable="false">
      <path
        className="paivo-closing"
        d={CENTRE_LINE}
        pathLength={1000}
        fill="none"
        stroke="currentColor"
        strokeWidth={38}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1000 1000"
      />
    </svg>
  );
}
