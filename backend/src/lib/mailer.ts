// Transactional email via Resend's REST API (no SDK, so no extra dependency).
// Disabled until RESEND_API_KEY is set. Mail is sent from our own verified domain,
// with Reply-To pointing at the seller so client replies reach them directly.

const API_KEY = process.env.RESEND_API_KEY || "";
const FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || "reminders@paivo.in";

export const emailEnabled = (): boolean => Boolean(process.env.RESEND_API_KEY);

// Names go into a header: strip anything that could break out of it.
function cleanName(s: string): string {
  return s.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Paivo";
}

export function cleanSubject(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface MailInput {
  to: string;
  fromName: string;
  replyTo?: string;
  subject: string;
  text: string;
  payUrl?: string;
  unsubscribeUrl?: string;
  brandColor?: string | null;
  buttonLabel?: string;
}

export async function sendMail(input: MailInput): Promise<{ id: string }> {
  if (!API_KEY && !process.env.RESEND_API_KEY) throw new Error("Email sending is not configured");
  const key = process.env.RESEND_API_KEY || API_KEY;

  const footer =
    `\n\n--\nSent by ${cleanName(input.fromName)} using Paivo. Reply to this email to reach ${cleanName(input.fromName)} directly.`;
  const text = input.text + (input.payUrl ? `\n\n${input.buttonLabel || "View and pay online"}: ${input.payUrl}` : "") + footer + (input.unsubscribeUrl ? `\nDon't want these emails? Unsubscribe: ${input.unsubscribeUrl}` : "");
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap">${esc(input.text)}</div>` +
    (input.payUrl
      ? `<p style="margin:20px 0"><a href="${esc(input.payUrl)}" style="background:${/^#[0-9a-f]{6}$/i.test(input.brandColor || "") ? input.brandColor : "#4f46e5"};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:bold">${esc(input.buttonLabel || "View and pay online")}</a></p>`
      : "") +
    `<p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b">Sent by ${esc(cleanName(input.fromName))} using Paivo. Reply to this email to reach ${esc(cleanName(input.fromName))} directly. ${input.unsubscribeUrl ? `<a href="${esc(input.unsubscribeUrl)}" style="color:#64748b">Unsubscribe</a>` : ""}</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${cleanName(input.fromName)} via Paivo <${FROM_ADDRESS}>`,
      to: [input.to],
      reply_to: input.replyTo ? [input.replyTo] : undefined,
      subject: cleanSubject(input.subject),
      headers: input.unsubscribeUrl
        ? { "List-Unsubscribe": `<${input.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
        : undefined,
      text,
      html,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Email provider error (${res.status})`);
  return { id: String(data.id || "") };
}
