// Temporary plain-JS seed runner (same data as prisma/seed.ts) so it can run
// without tsx/esbuild, which the sandbox blocks. Uses the already-compiled
// Prisma client in dist/. Delete after seeding.
process.chdir(__dirname);
const prisma = require("./dist/lib/prisma.js").default;
const bcrypt = require("bcryptjs");

const ORG_SLUG = "acme";
const DEMO_EMAIL = "demo@ledgerlane.dev";

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

(async () => {
  const existing = await prisma.organizations.findUnique({ where: { slug: ORG_SLUG } });
  if (existing) {
    console.log(`Seed already present (slug "${ORG_SLUG}"). Skipping.`);
    await prisma.$disconnect();
    return;
  }

  const org = await prisma.organizations.create({ data: { name: "Acme Studios", slug: ORG_SLUG } });
  await prisma.users.create({
    data: { organization_id: org.id, email: DEMO_EMAIL, name: "Demo Owner", password_hash: bcrypt.hashSync("demo1234", 12) },
  });

  const customerData = [
    { name: "Rohan Mehta", company_name: "Pixelwave Digital", email: "rohan@pixelwave.in", phone: "+91 98200 10001" },
    { name: "Sana Kapoor", company_name: "Bloom Interiors", email: "sana@bloominteriors.co", phone: "+91 98111 20002" },
    { name: "Arjun Nair", company_name: "Coastline Logistics", email: "arjun@coastline.in", phone: "+91 98300 30003" },
    { name: "Priya Iyer", company_name: "Nova Consulting", email: "priya@novaconsult.in", phone: "+91 98400 40004" },
    { name: "Vikram Singh", company_name: "Ironclad Manufacturing", email: "vikram@ironclad.in", phone: "+91 98500 50005" },
    { name: "Meera Joshi", company_name: "Kindred Foods", email: "meera@kindredfoods.co", phone: "+91 98600 60006" },
  ];
  const customers = [];
  for (const c of customerData) {
    customers.push(await prisma.customers.create({ data: { organization_id: org.id, ...c } }));
  }
  const [rohan, sana, arjun, priya, vikram, meera] = customers;

  const invoiceSpecs = [
    { customer: rohan, number: "INV-1042", amount: 45000, issued: -45, due: -15 },
    { customer: sana, number: "INV-1043", amount: 78000, issued: -40, due: -10 },
    { customer: arjun, number: "INV-1044", amount: 120000, issued: -30, due: -5 },
    { customer: priya, number: "INV-1045", amount: 25000, issued: -20, due: 10 },
    { customer: vikram, number: "INV-1046", amount: 310000, issued: -25, due: 15 },
    { customer: meera, number: "INV-1047", amount: 52000, issued: -10, due: 20 },
    { customer: rohan, number: "INV-1018", amount: 60000, issued: -90, due: -60 },
    { customer: sana, number: "INV-1019", amount: 33000, issued: -85, due: -55 },
    { customer: arjun, number: "INV-1020", amount: 90000, issued: -60, due: -30 },
    { customer: priya, number: "INV-1021", amount: 15000, issued: -50, due: -20 },
    { customer: vikram, number: "INV-1022", amount: 200000, issued: -70, due: -40 },
    { customer: meera, number: "INV-1023", amount: 44000, issued: -5, due: 25 },
  ];

  const invoices = [];
  for (const s of invoiceSpecs) {
    invoices.push(await prisma.invoices.create({
      data: {
        organization_id: org.id,
        customer_id: s.customer.id,
        invoice_number: s.number,
        amount: s.amount,
        currency: "INR",
        issued_at: daysFromNow(s.issued),
        due_at: daysFromNow(s.due),
        status: "OPEN",
      },
    }));
  }
  const byNumber = Object.fromEntries(invoices.map((i) => [i.invoice_number, i]));

  const payments = [
    { invoice: "INV-1018", amount: 60000 },
    { invoice: "INV-1019", amount: 33000 },
    { invoice: "INV-1020", amount: 45000 },
    { invoice: "INV-1021", amount: 15000 },
    { invoice: "INV-1022", amount: 100000 },
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

  const threads = [
    { customer: rohan, invoice: byNumber["INV-1042"], subject: "Re: Invoice INV-1042 overdue", inbound: "Hi, I haven't received this invoice yet. Can you please resend it to rohan@pixelwave.in?", intent: "INVOICE_ISSUE", confidence: 0.92, action: "RESEND_INVOICE" },
    { customer: sana, invoice: byNumber["INV-1043"], subject: "Payment for INV-1043", inbound: "I will make the payment on the 28th. Please give me until then, the amount is a bit high this month.", intent: "PAYMENT_PROMISED", confidence: 0.88, action: "FOLLOW_UP_SCHEDULED" },
    { customer: arjun, invoice: byNumber["INV-1044"], subject: "Wrong invoice", inbound: "I don't agree with this invoice. The amount is incorrect — we were quoted 90,000, not 120,000.", intent: "DISPUTE", confidence: 0.94, action: "ESCALATE_DISPUTE" },
  ];

  for (const t of threads) {
    const conversation = await prisma.conversations.create({
      data: { organization_id: org.id, customer_id: t.customer.id, invoice_id: t.invoice.id, channel: "EMAIL" },
    });
    await prisma.messages.create({
      data: {
        organization_id: org.id, conversation_id: conversation.id, direction: "OUTBOUND", channel: "EMAIL",
        sender: "billing@acmestudios.in", recipient: t.customer.email,
        subject: `Invoice ${t.invoice.invoice_number} — payment reminder`,
        body: `Hi ${t.customer.name.split(" ")[0]}, this is a friendly reminder that invoice ${t.invoice.invoice_number} is now due. Could you please let us know the payment status?`,
      },
    });
    const inbound = await prisma.messages.create({
      data: {
        organization_id: org.id, conversation_id: conversation.id, direction: "INBOUND", channel: "EMAIL",
        sender: t.customer.email, recipient: "billing@acmestudios.in", subject: t.subject, body: t.inbound,
        ai_intent: t.intent, ai_confidence: t.confidence,
      },
    });
    await prisma.collection_actions.create({
      data: {
        organization_id: org.id, customer_id: t.customer.id, invoice_id: t.invoice.id, conversation_id: conversation.id,
        action_type: t.action, status: "PENDING", scheduled_at: new Date(),
        metadata: { message_id: inbound.id, ai_intent: t.intent, ai_confidence: t.confidence, low_confidence: false },
      },
    });
  }

  console.log("Seed complete. Login: demo@ledgerlane.dev / demo1234");
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
