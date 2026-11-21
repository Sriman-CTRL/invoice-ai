import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Idempotent demo seed. Creates a single demo organization with customers,
 * invoices, payments, conversations, messages and collection actions so the
 * dashboard and playground have something to show on first login.
 *
 *   npx tsx prisma/seed.ts      (or `npm run seed` in backend/)
 *
 * Login afterwards with:
 *   email    demo@ledgerlane.dev
 *   password demo1234
 */

const ORG_SLUG = "acme";
const DEMO_EMAIL = "demo@ledgerlane.dev";

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const existing = await prisma.organizations.findUnique({ where: { slug: ORG_SLUG } });
  if (existing) {
    console.log(`Seed already present (organization slug "${ORG_SLUG}"). Skipping.`);
    return;
  }

  const org = await prisma.organizations.create({
    data: { name: "Acme Studios", slug: ORG_SLUG },
  });

  await prisma.users.create({
    data: {
      organization_id: org.id,
      email: DEMO_EMAIL,
      name: "Demo Owner",
      password_hash: await bcrypt.hash("demo1234", 12),
    },
  });

  const customers = await Promise.all(
    [
      { name: "Rohan Mehta", company_name: "Pixelwave Digital", email: "rohan@pixelwave.in", phone: "+91 98200 10001" },
      { name: "Sana Kapoor", company_name: "Bloom Interiors", email: "sana@bloominteriors.co", phone: "+91 98111 20002" },
      { name: "Arjun Nair", company_name: "Coastline Logistics", email: "arjun@coastline.in", phone: "+91 98300 30003" },
      { name: "Priya Iyer", company_name: "Nova Consulting", email: "priya@novaconsult.in", phone: "+91 98400 40004" },
      { name: "Vikram Singh", company_name: "Ironclad Manufacturing", email: "vikram@ironclad.in", phone: "+91 98500 50005" },
      { name: "Meera Joshi", company_name: "Kindred Foods", email: "meera@kindredfoods.co", phone: "+91 98600 60006" },
    ].map((c) => prisma.customers.create({ data: { organization_id: org.id, ...c } })),
  );
  const [rohan, sana, arjun, priya, vikram, meera] = customers;

  const invoiceSpecs = [
    { customer: rohan, number: "INV-1042", amount: 45000, issued: -45, due: -15 },      // overdue
    { customer: sana, number: "INV-1043", amount: 78000, issued: -40, due: -10 },       // overdue
    { customer: arjun, number: "INV-1044", amount: 120000, issued: -30, due: -5 },      // overdue
    { customer: priya, number: "INV-1045", amount: 25000, issued: -20, due: 10 },       // open
    { customer: vikram, number: "INV-1046", amount: 310000, issued: -25, due: 15 },     // open, big
    { customer: meera, number: "INV-1047", amount: 52000, issued: -10, due: 20 },       // open
    { customer: rohan, number: "INV-1018", amount: 60000, issued: -90, due: -60 },      // paid
    { customer: sana, number: "INV-1019", amount: 33000, issued: -85, due: -55 },       // paid
    { customer: arjun, number: "INV-1020", amount: 90000, issued: -60, due: -30 },      // partially paid
    { customer: priya, number: "INV-1021", amount: 15000, issued: -50, due: -20 },      // paid
    { customer: vikram, number: "INV-1022", amount: 200000, issued: -70, due: -40 },    // partially paid
    { customer: meera, number: "INV-1023", amount: 44000, issued: -5, due: 25 },        // open
  ];

  const invoices = await Promise.all(
    invoiceSpecs.map(({ customer, number, amount, issued, due }) =>
      prisma.invoices.create({
        data: {
          organization_id: org.id,
          customer_id: customer.id,
          invoice_number: number,
          amount,
          currency: "INR",
          issued_at: daysFromNow(issued),
          due_at: daysFromNow(due),
          status: "OPEN",
        },
      }),
    ),
  );

  const byNumber = Object.fromEntries(invoices.map((i) => [i.invoice_number, i]));

  // Payments: settle the PAID and PARTIALLY_PAID invoices.
  const payments: Array<{ invoice: string; amount: number }> = [
    { invoice: "INV-1018", amount: 60000 },
    { invoice: "INV-1019", amount: 33000 },
    { invoice: "INV-1020", amount: 45000 }, // partial
    { invoice: "INV-1021", amount: 15000 },
    { invoice: "INV-1022", amount: 100000 }, // partial
  ];
  for (const p of payments) {
    const inv = byNumber[p.invoice];
    await prisma.payments.create({
      data: {
        organization_id: org.id,
        invoice_id: inv.id,
        amount: p.amount,
        currency: "INR",
        status: "SUCCEEDED",
        paid_at: daysFromNow(-14),
        external_payment_id: `pay_${p.invoice.toLowerCase()}`,
      },
    });
    await prisma.invoices.update({
      where: { id: inv.id },
      data: { status: Number(inv.amount) === p.amount ? "PAID" : "PARTIALLY_PAID" },
    });
  }

  // Three conversation threads with realistic inbound replies.
  const threads = [
    {
      customer: rohan,
      invoice: byNumber["INV-1042"],
      subject: "Re: Invoice INV-1042 overdue",
      inbound: "Hi, I haven't received this invoice yet. Can you please resend it to rohan@pixelwave.in?",
      intent: "INVOICE_ISSUE",
      confidence: 0.92,
      action: "RESEND_INVOICE",
    },
    {
      customer: sana,
      invoice: byNumber["INV-1043"],
      subject: "Payment for INV-1043",
      inbound: "I will make the payment on the 28th. Please give me until then, the amount is a bit high this month.",
      intent: "PAYMENT_PROMISED",
      confidence: 0.88,
      action: "FOLLOW_UP_SCHEDULED",
    },
    {
      customer: arjun,
      invoice: byNumber["INV-1044"],
      subject: "Wrong invoice",
      inbound: "I don't agree with this invoice. The amount is incorrect — we were quoted 90,000, not 120,000.",
      intent: "DISPUTE",
      confidence: 0.94,
      action: "ESCALATE_DISPUTE",
    },
  ];

  for (const t of threads) {
    const conversation = await prisma.conversations.create({
      data: {
        organization_id: org.id,
        customer_id: t.customer.id,
        invoice_id: t.invoice.id,
        channel: "EMAIL",
      },
    });

    await prisma.messages.create({
      data: {
        organization_id: org.id,
        conversation_id: conversation.id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        sender: "billing@acmestudios.in",
        recipient: t.customer.email,
        subject: `Invoice ${t.invoice.invoice_number} — payment reminder`,
        body: `Hi ${t.customer.name.split(" ")[0]}, this is a friendly reminder that invoice ${t.invoice.invoice_number} is now due. Could you please let us know the payment status?`,
      },
    });

    const inbound = await prisma.messages.create({
      data: {
        organization_id: org.id,
        conversation_id: conversation.id,
        direction: "INBOUND",
        channel: "EMAIL",
        sender: t.customer.email,
        recipient: "billing@acmestudios.in",
        subject: t.subject,
        body: t.inbound,
        ai_intent: t.intent,
        ai_confidence: t.confidence,
      },
    });

    await prisma.collection_actions.create({
      data: {
        organization_id: org.id,
        customer_id: t.customer.id,
        invoice_id: t.invoice.id,
        conversation_id: conversation.id,
        action_type: t.action,
        status: "PENDING",
        scheduled_at: new Date(),
        metadata: {
          message_id: inbound.id,
          ai_intent: t.intent,
          ai_confidence: t.confidence,
          low_confidence: false,
        },
      },
    });
  }

  console.log("Seed complete.");
  console.log(`  Login: ${DEMO_EMAIL} / demo1234`);
  console.log(`  Inbox address: ${ORG_SLUG}@in.ar.ledgerlane.local`);
  console.log(`  Invoices: ${invoices.length}, customers: ${customers.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
