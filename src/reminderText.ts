/**
 * Template-based payment reminder text for the free reminder writer. No AI, no network. Tone is always polite:
 * "final" means last friendly nudge, never a threat or a legal warning.
 */

export type Tone = "friendly" | "firm" | "final";

export interface ReminderInput {
  tone: Tone;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  daysOverdue: number;
  yourName: string;
  payLink?: string;
}

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

function lateness(days: number): string {
  if (days <= 0) return "is due now";
  if (days === 1) return "was due yesterday";
  return `is ${days} days overdue`;
}

export function buildReminderText(i: ReminderInput): string {
  const name = i.clientName.trim() || "there";
  const inv = i.invoiceNumber.trim() || "your invoice";
  const amount = Number.isFinite(i.amount) && i.amount > 0 ? inr(i.amount) : "the pending amount";
  const sender = i.yourName.trim();
  const link = i.payLink?.trim() ? `\n\nYou can pay here: ${i.payLink.trim()}` : "";
  const bye = sender ? `\n\nThank you,\n${sender}` : "\n\nThank you";
  const paid = "If you have already paid, thank you, and please send me the UTR so I can match it.";
  const late = lateness(Math.floor(Number.isFinite(i.daysOverdue) ? i.daysOverdue : 0));

  if (i.tone === "friendly") {
    return `Hi ${name},\n\nA quick reminder that invoice ${inv} for ${amount} ${late}. It may just have slipped through, so I am sending a nudge.${link}\n\n${paid}${bye}`;
  }
  if (i.tone === "firm") {
    return `Hello ${name},\n\nFollowing up on invoice ${inv} for ${amount}, which ${late}. Could you please clear it this week, or let me know the date I can expect the payment?${link}\n\n${paid} If something is holding it up, tell me and we can sort it out together.${bye}`;
  }
  return `Hello ${name},\n\nThis is my last reminder about invoice ${inv} for ${amount}, which ${late}. I would like to close this account properly, so please let me know today when the payment will be made, or if there is any problem with the invoice or the work.${link}\n\n${paid}${bye}`;
}

/** WhatsApp "share" link with the text prefilled. The person picks the contact, so no phone number is handled here. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
