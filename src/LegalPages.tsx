import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileCheck,
  Lock,
  Mail,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Workspace</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-mono text-sm font-black tracking-tight text-white">
              INVOICE<span className="text-brand-400">.AI</span>
            </span>
          </div>

          <Link
            to="/terms"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline"
          >
            Terms of Service →
          </Link>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-midnight-950 via-slate-950 to-slate-950 px-6 py-16">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-bold text-emerald-400 mb-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>DESIGNED FOR DPDP ACT 2023 & GDPR</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Privacy & Data Protection Policy
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
            How Invoice AI collects, stores and uses customer billing details,
            final-file links, and email replies.
          </p>
          <p className="mt-2 text-xs font-mono text-slate-500">
            Last Updated & Vetted: November 2026 · Effective Date: Immediate
          </p>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Quick Bento Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-14">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Shield className="h-5 w-5 text-emerald-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero Data Selling</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              We never sell, rent, or monetize your company or client records to data brokers or ad networks.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Database className="h-5 w-5 text-indigo-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Tenant Isolation</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Every request is authorised against the signed-in organization, and payment links use unguessable random identifiers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Lock className="h-5 w-5 text-amber-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">No Banking Secrets</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              We never request, handle, or store UPI MPINs, debit card CVVs, or online banking passwords.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Scale className="h-5 w-5 text-brand-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Right to Erasure</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              You can erase a client's personal details from the app, or email us and ask.
            </p>
          </div>
        </div>

        {/* Detailed Legal Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-300">
          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">01.</span> Scope & Data Controller
            </h2>
            <p>
              Invoice AI (&ldquo;Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides an invoicing, payment-confirmation and
              payment-reminder service for freelancers, agencies, and micro-SMEs. It is not an escrow or dispute-resolution service.
              This Privacy Policy explains how we process personal and commercial data when you access our dashboard
              at <code className="text-slate-200 bg-white/5 px-1 py-0.5 rounded font-mono text-xs">paivo.in</code> or
              interact with public checkout portals (<code className="text-slate-200 bg-white/5 px-1 py-0.5 rounded font-mono text-xs">/pay/:invoice_id</code>).
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">02.</span> Categories of Data Collected
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-200">Merchant Account Credentials:</strong> Work email, hashed and salted password (bcrypt), full name, company name, and organization tenant ID.
              </li>
              <li>
                <strong className="text-slate-200">Invoicing & Customer Records:</strong> Client business names, corporate email addresses, phone numbers (for WhatsApp intent links), invoice line items, amounts, currency, and due dates.
              </li>
              <li>
                <strong className="text-slate-200">Final-file links:</strong> URLs to deliverables (e.g. Figma links, Google Drive assets, GitHub repositories, or zip files) stored with the invoice and shown to your client only after you confirm full payment. We store the link, not the files.
              </li>
              <li>
                <strong className="text-slate-200">Payment Reference Metadata:</strong> Client-reported 12-digit UTR (Unique Transaction Reference) codes, NPCI UPI transaction reference strings, and TDS deduction tax categories (Section 194C/194J). <em>We do not hold funds or store payment instruments (no card numbers, CVVs, or bank net-banking passwords).</em>
              </li>
              <li>
                <strong className="text-slate-200">Inbound Communication Telemetry:</strong> Inbound billing emails and responses processed transiently for payment promises or dispute classifications via Google Gemini AI.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">03.</span> How Final-File Links Are Shown
            </h2>
            <p>
              When a merchant adds a final-files link to an invoice, the client's payment page only says that files are attached.
              Clients viewing <code className="text-slate-200 bg-white/5 px-1 py-0.5 rounded font-mono text-xs">/pay/:invoice_id</code> do not receive the link itself until the
              invoice status becomes <span className="font-mono text-emerald-400 font-bold">PAID</span>.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">04.</span> Multi-Tenant Data Isolation & Security
            </h2>
            <p>
              All customer and invoice data is hosted on serverless Neon PostgreSQL with enforced tenant isolation. Every database
              read, update, and row-lock operation executes strictly within the authenticated organization boundary
              (<code className="text-slate-200 bg-white/5 px-1 py-0.5 rounded font-mono text-xs">organization_id</code>). All API communication is
              sent over HTTPS. Our database rules (row-level security) keep each business's records separate.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">05.</span> Reminder Emails and Opt-Outs
            </h2>
            <p>
              Reminder emails sent through Invoice AI follow these rules:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">Limits:</strong> An invoice gets at most one reminder email in 24 hours, and a daily cap applies to each business.
              </li>
              <li>
                <strong className="text-slate-200">Automated Suppressions:</strong> If a customer opts out, their address is added to a suppression list and no more reminders are sent to it. Reminders also pause while an invoice is marked as disputed.
              </li>
              <li>
                <strong className="text-slate-200">Every email includes:</strong> the payment link, an unsubscribe link, and the seller's address as Reply-To.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">06.</span> Error Monitoring (Sentry)
            </h2>
            <p>
              When something breaks, we use <strong className="text-slate-200">Sentry</strong> (operated by Functional Software, Inc.) to find out so we can fix it.
              We only send error reports. We do not record sessions or screens.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li><strong className="text-slate-200">What is sent:</strong> technical error details (the error message and where in the code it happened), your browser and device type, and the page address with ids and tokens removed (for example <code className="text-slate-200 bg-white/5 px-1 py-0.5 rounded font-mono text-xs">/pay/[id]</code>), plus an internal account id when you are signed in.</li>
              <li><strong className="text-slate-200">What is not sent:</strong> client names, email addresses, UPI IDs, UTRs, bank account numbers, GSTINs, passwords, sign-in tokens, request contents or cookies. These are removed on your device or our server before a report leaves it.</li>
              <li><strong className="text-slate-200">Where it is stored:</strong> in Sentry's United States data region.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">07.</span> Rights Under Indian DPDP Act 2023 & GDPR
            </h2>
            <p>
              Users and their customers possess the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Request an export of all recorded balances and conversation records.</li>
              <li>Invoke the Right to Erasure, triggering immediate anonymization of customer identifiers.</li>
              <li>Withdraw consent for automated WhatsApp or email communications.</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              To exercise data subject rights, email <a href="mailto:privacy@paivo.in" className="text-brand-400 underline">privacy@paivo.in</a> or utilize the in-app GDPR Erasure action.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Invoice AI · Built for Freelancers, Agencies & Micro-SMEs.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/terms" className="hover:text-slate-300">Terms of Service</Link>
          <span>•</span>
          <Link to="/login" className="hover:text-slate-300">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Workspace</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-mono text-sm font-black tracking-tight text-white">
              INVOICE<span className="text-brand-400">.AI</span>
            </span>
          </div>

          <Link
            to="/privacy"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 hover:underline"
          >
            Privacy Policy →
          </Link>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-midnight-950 via-slate-950 to-slate-950 px-6 py-16">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-mono font-bold text-brand-400 mb-4">
            <Scale className="h-3.5 w-3.5" />
            <span>TERMS OF SERVICE</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Terms of Service
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
            Terms for using Invoice AI: invoices, final-file links that unlock after payment, direct client-to-seller
            payment confirmation, and payment reminders. Invoice AI is not an escrow service.
          </p>
          <p className="mt-2 text-xs font-mono text-slate-500">
            Last Updated: November 2026 · Legally Binding Agreement
          </p>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Quick Bento Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-14">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Zap className="h-5 w-5 text-brand-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">0% Platform Cut</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              We never take a cut of your payments. Settlements move 100% direct peer-to-peer bank-to-bank.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <Lock className="h-5 w-5 text-amber-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Files Unlock After Payment</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Project deliverables remain locked until the merchant confirms payment settlement.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <ShieldAlert className="h-5 w-5 text-rose-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Non-Custodial</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              Invoice AI is a software facilitation layer, not an RBI-licensed bank or financial custodian.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 backdrop-blur-sm">
            <FileCheck className="h-5 w-5 text-emerald-400 mb-2" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Valid Claims Only</h4>
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
              You may only send reminders for real, legitimate invoices.
            </p>
          </div>
        </div>

        {/* Detailed Legal Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-slate-300">
          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">01.</span> Agreement & Nature of the Platform
            </h2>
            <p>
              By signing up for an account, generating an invoice, or accessing a public checkout link, you agree
              to be legally bound by these Terms of Service. Invoice AI operates solely as an independent software
              platform for invoice tracking, locking final-file links until payment is confirmed, and
              payment reminders.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">02.</span> Non-Custodial Financial Disclaimer
            </h2>
            <p className="text-slate-300">
              <strong className="text-amber-300">IMPORTANT NOTICE:</strong> Invoice AI does NOT operate as a bank,
              non-banking financial company (NBFC), payment aggregator, or financial fiduciary.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                All monetary payments are conducted <strong className="text-slate-200">directly peer-to-peer (P2P)</strong> between
                the Client and the Merchant via the Unified Payments Interface (NPCI UPI), IMPS, NEFT, RTGS, or wire transfers.
              </li>
              <li>
                Invoice AI does not hold, intermediate, or custody any funds at any point in the transaction cycle.
              </li>
              <li>
                UTR numbers and bank reference IDs submitted on the platform serve as informational settlement proofs
                to trigger workflow transitions and deliverable unlocking.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">03.</span> Final-File Links (Locked Until Paid)
            </h2>
            <p>
              This feature allows creators, freelancers, and agencies to attach a link to final work
              deliverables (e.g. Figma files, source code repositories, design assets, or analytical reports) to an invoice.
              Invoice AI stores only the link. It is not an escrow agent and does not hold files or money.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">Locking Mechanism:</strong> Deliverable links remain inaccessible to the Client
                until the merchant verifies the payment proof or marks the invoice status as <span className="font-mono text-emerald-400 font-bold">PAID</span>.
              </li>
              <li>
                <strong className="text-slate-200">Merchant Ownership Warranty:</strong> The merchant warrants that they hold full legal rights,
                title, and intellectual property permissions to all attached deliverables.
              </li>
              <li>
                <strong className="text-slate-200">Instant Release:</strong> Once the invoice is marked settled, access is unlocked immediately.
                Invoice AI is not liable for deliverable defects, content disputes, or service quality disagreements between Merchant and Client.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">04.</span> Permissible Use & Autonomous Collection Rules
            </h2>
            <p>
              Merchants using Invoice AI&apos;s autonomous collection engine agree to adhere to all fair debt collection standards:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>
                You may only issue invoices and collection reminders for bona fide, legitimate commercial goods or services rendered.
              </li>
              <li>
                You may not use autonomous email or WhatsApp dispatch to harass, defame, intimidate, or send deceptive messages.
              </li>
              <li>
                Reminders respect suppression (opt-out) records. Bypassing or attempting
                to circumvent suppressions constitutes grounds for immediate account termination.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">05.</span> Limitation of Liability
            </h2>
            <p>
              In no event shall Invoice AI, its founders, or contributors be held liable for indirect, incidental, punitive,
              or consequential damages resulting from lost profits, unpaid client invoices, banking network downtimes,
              or payment disputes between commercial parties. In all cases, our aggregate liability is capped at the fees
              paid by the merchant to Invoice AI in the preceding three (3) months.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="font-mono text-brand-400 text-sm">06.</span> Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms of Service are governed by and construed in accordance with the laws of the Republic of India.
              Any legal disputes, arbitrations, or claims arising from the platform shall be subject to the exclusive
              jurisdiction of the courts of Hyderabad / Telangana, India.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Invoice AI · Built for Freelancers, Agencies & Micro-SMEs.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
          <span>•</span>
          <Link to="/login" className="hover:text-slate-300">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
