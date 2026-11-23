import prisma from "./prisma";
import { computeTotals, parseDetails, saveDetails } from "./invoiceDetails";
import { emailEnabled, sendMail } from "./mailer";

export type Frequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
export const FREQUENCIES: Frequency[] = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"];

/** Add one period to a YYYY-MM-DD date. Month-based periods clamp to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addPeriod(isoDate: string, freq: Frequency): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (freq === "WEEKLY") {
    const t = new Date(Date.UTC(y, m - 1, d + 7));
    return t.toISOString().slice(0, 10);
  }
  const months = freq === "MONTHLY" ? 1 : freq === "QUARTERLY" ? 3 : 12;
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, last);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

interface DueRow {
  id: string;
  organization_id: string;
  customer_id: string;
  template: any;
  frequency: Frequency;
  next_run: string;
  runs: number;
}

/**
 * Creates the DRAFT invoice for every schedule that is due. Safe to call repeatedly: each schedule is
 * claimed with a compare-and-set on next_run, so two overlapping runs can never create the same invoice twice.
 * Drafts are never sent to the client automatically; the owner reviews and approves each one.
 */
export async function runDueRecurring(publicUrl: string): Promise<{ created: number; failed: number }> {
  const due = await prisma.$queryRawUnsafe<DueRow[]>(
    `SELECT id, organization_id, customer_id, template, frequency, to_char(next_run, 'YYYY-MM-DD') AS next_run, runs
       FROM recurring_invoices WHERE active = true AND next_run <= current_date ORDER BY next_run LIMIT 200`,
  );
  let created = 0;
  let failed = 0;

  for (const row of due) {
    const nextRun = addPeriod(row.next_run, row.frequency);
    const claimed = await prisma.$executeRawUnsafe(
      `UPDATE recurring_invoices SET next_run = $3::date, runs = runs + 1 WHERE id = $1::uuid AND next_run = $2::date AND active = true`,
      row.id, row.next_run, nextRun,
    );
    if (!claimed) continue; // another run took it

    try {
      const t = row.template || {};
      const parsed = parseDetails({ items: t.items, discount: t.discount, tax_mode: t.tax_mode, tax_percent: t.tax_percent, notes: t.notes });
      if (!parsed || "error" in parsed) throw new Error(parsed && "error" in parsed ? parsed.error : "Bad template");
      const totals = computeTotals(parsed.details.items, parsed.details.discount, parsed.details.tax_percent, parsed.details.tax_mode);

      const issued = row.next_run;
      const termsDays = Math.min(Math.max(Number(t.terms_days) || 0, 0), 120);
      const dueDate = new Date(issued + "T00:00:00Z");
      dueDate.setUTCDate(dueDate.getUTCDate() + termsDays);
      const prefix = String(t.prefix || "REC").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "REC";
      const base = `${prefix}-${issued.replace(/-/g, "")}`;

      let number = base;
      for (let n = 2; n < 20; n++) {
        const exists = await prisma.invoices.findFirst({ where: { organization_id: row.organization_id, invoice_number: number }, select: { id: true } });
        if (!exists) break;
        number = `${base}-${n}`;
      }

      const invoice = await prisma.invoices.create({
        data: {
          organization_id: row.organization_id,
          customer_id: row.customer_id,
          invoice_number: number,
          external_invoice_id: t.deliverable ? `vault:${t.deliverable}` : undefined,
          amount: totals.total,
          currency: t.currency || "INR",
          issued_at: new Date(issued + "T00:00:00Z"),
          due_at: dueDate,
          status: "DRAFT",
        },
      });
      await saveDetails(row.organization_id, invoice.id, parsed.details);
      await prisma.$executeRawUnsafe(`UPDATE recurring_invoices SET last_invoice_id = $2::uuid WHERE id = $1::uuid`, row.id, invoice.id);
      created++;

      if (emailEnabled()) {
        const owner = await prisma.users.findFirst({ where: { organization_id: row.organization_id }, orderBy: { created_at: "asc" }, select: { email: true } });
        const cust = await prisma.customers.findFirst({ where: { id: row.customer_id }, select: { name: true } });
        if (owner?.email) {
          await sendMail({
            to: owner.email,
            fromName: "Paivo",
            subject: `Draft invoice ready: ${number} for ${cust?.name || "your client"}`,
            text: `Your recurring invoice ${number} (${(t.currency || "INR")} ${totals.total.toFixed(2)}) for ${cust?.name || "your client"} has been created as a draft.\n\nNothing has been sent to your client. Review it and press "Send" when you're happy.`,
            payUrl: `${publicUrl}/invoices/${invoice.id}`,
            buttonLabel: "Review the draft",
          }).catch((e) => console.warn("draft notice email failed:", (e as Error).message));
        }
      }
    } catch (e) {
      failed++;
      console.error("recurring run failed:", row.id, (e as Error).message);
      // Put the schedule back so the next daily run retries it.
      await prisma
        .$executeRawUnsafe(`UPDATE recurring_invoices SET next_run = $2::date, runs = GREATEST(runs - 1, 0) WHERE id = $1::uuid`, row.id, row.next_run)
        .catch(() => {});
    }
  }
  return { created, failed };
}

export const _todayIso = todayIso;
