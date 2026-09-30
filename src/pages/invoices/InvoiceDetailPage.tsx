import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import { invoicesApi, paymentsApi } from "../../api";
import type { InvoiceDetail, Payment } from "../../types";
import { money, date, dateTime, formatActionType, cn } from "../../lib/utils";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { DetailSkeleton } from "../../components/ui/LoadingSkeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("USD");
  const [paymentStatus, setPaymentStatus] = useState("SUCCEEDED");
  const [paymentExternalId, setPaymentExternalId] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const fetchInvoice = () => {
    setLoading(true);
    setError(null);
    invoicesApi
      .detail(id)
      .then((res) => {
        setData(res);
        setPaymentCurrency(res.financial_summary.currency || "USD");
        setPaymentAmount(String(res.financial_summary.outstanding_amount || ""));
      })
      .catch((err) => {
        setError(err.message || "Failed to load invoice details.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Please specify a positive payment amount.");
      return;
    }

    if (data && amountNum > data.financial_summary.outstanding_amount) {
      setPaymentError(
        `Payment exceeds remaining balance of ${money(
          data.financial_summary.outstanding_amount,
          data.financial_summary.currency
        )}.`
      );
      return;
    }

    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await paymentsApi.create({
        invoice_id: id,
        amount: amountNum,
        currency: paymentCurrency,
        status: paymentStatus,
        external_payment_id: paymentExternalId || undefined,
        paid_at: new Date().toISOString(),
      });
      setPaymentModalOpen(false);
      fetchInvoice();
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading && !data) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoice Details" backTo="/invoices" backLabel="Back to Invoices" />
        <ErrorState message={error || "Invoice not found"} retry={fetchInvoice} />
      </div>
    );
  }

  const { invoice, customer, financial_summary, payments, conversations, collection_actions } = data;
  const isPastDue = invoice.due_at && new Date(invoice.due_at) < new Date() && (invoice.status === "OPEN" || invoice.status === "PARTIALLY_PAID");

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`Issued on ${date(invoice.issued_at)} · Maturity date: ${date(invoice.due_at)}`}
        backTo="/invoices"
        backLabel="Back to Invoices"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchInvoice}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
              <Button
                size="sm"
                variant="brand"
                onClick={() => setPaymentModalOpen(true)}
                icon={<CreditCard className="h-3.5 w-3.5" />}
              >
                Record Payment
              </Button>
            )}
          </div>
        }
      />

      {/* Overdue Warning Alert */}
      {isPastDue && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-300 bg-rose-50/70 p-4 text-xs sm:text-sm text-rose-900 shadow-soft">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Maturity Breach:</span> This invoice was due on{" "}
            {date(invoice.due_at)} and has an outstanding balance of{" "}
            {money(financial_summary.outstanding_amount, financial_summary.currency)}.
          </div>
          <Badge value="OVERDUE" kind="invoice" isOverdue={true} />
        </div>
      )}

      {/* Financial Health Summary Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Invoice Face Value</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-ink font-mono tabular-nums">
            {money(financial_summary.invoice_amount, financial_summary.currency)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>Status</span>
            <Badge value={invoice.status} kind="invoice" isOverdue={Boolean(isPastDue)} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Confirmed Paid</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-700 font-mono tabular-nums">
            {money(financial_summary.paid_amount, financial_summary.currency)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>Settled transactions</span>
            <span className="font-semibold text-ink">{payments.length}</span>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Remaining Balance</p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold tracking-tight font-mono tabular-nums",
              financial_summary.outstanding_amount > 0 ? "text-rose-700" : "text-slate-500"
            )}
          >
            {money(financial_summary.outstanding_amount, financial_summary.currency)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>Settlement ratio</span>
            <span className="font-semibold text-ink">
              {financial_summary.invoice_amount > 0
                ? Math.round(
                    (financial_summary.paid_amount / financial_summary.invoice_amount) * 100
                  )
                : 0}
              %
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Details & Side panels */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          {/* Payment Transactions Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Verified Payments History</CardTitle>
                <CardDescription>
                  Authoritative transactions credited to this invoice balance.
                </CardDescription>
              </div>
              {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaymentModalOpen(true)}
                  icon={<Plus className="h-3 w-3" />}
                >
                  Record
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead align="right">External Ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell mono>
                          <span className="font-bold text-emerald-700">
                            {money(p.amount, p.currency)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge value={p.status} kind="payment" />
                        </TableCell>
                        <TableCell>{date(p.paid_at || p.created_at)}</TableCell>
                        <TableCell align="right" mono>
                          <span className="text-xs text-muted">
                            {p.external_payment_id || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-6 text-center text-xs text-muted">
                  No payments have been recorded for this invoice yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Linked Collection Actions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Linked Collection Actions</CardTitle>
                <CardDescription>
                  Autonomous and agent follow-up operations scheduled for this invoice.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {collection_actions && collection_actions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead align="right">Executed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collection_actions.map((act) => (
                      <TableRow key={act.id}>
                        <TableCell>
                          <span className="font-medium text-ink">
                            {formatActionType(act.action_type)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge value={act.status} kind="action" />
                        </TableCell>
                        <TableCell>{date(act.scheduled_at)}</TableCell>
                        <TableCell align="right">
                          <span className="text-xs text-muted">
                            {act.executed_at ? date(act.executed_at) : "Pending"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-6 text-center text-xs text-muted">
                  No collection actions currently scheduled for this invoice.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar details */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Debtor Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customer ? (
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 font-bold text-slate-700 shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="font-semibold text-ink hover:text-brand-700 hover:underline block truncate text-sm"
                      >
                        {customer.name}
                      </Link>
                      <p className="text-xs text-muted truncate">
                        {customer.company_name || "Individual"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-line/60 pt-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/60">
                    <Link
                      to={`/customers/${customer.id}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span>View Customer 360° Profile</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">Customer details not found</p>
              )}
            </CardContent>
          </Card>

          {/* Active Conversations Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Communications</CardTitle>
              <Link to="/conversations" className="text-xs text-brand-700 hover:underline">
                Inbox
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {conversations && conversations.length > 0 ? (
                <div className="space-y-2">
                  {conversations.map((c) => (
                    <Link
                      key={c.id}
                      to={`/conversations/${c.id}`}
                      className="flex items-center justify-between rounded-lg border border-line p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-xs font-semibold text-ink">{c.channel} Thread</p>
                          <p className="text-[10px] text-muted">Updated {date(c.updated_at)}</p>
                        </div>
                      </div>
                      <Badge value={c.status} kind="generic" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  No conversation thread linked to this invoice. Messages sent by or to the customer will appear in the inbox.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Authoritative Payment"
        description={`Record verified settlement for Invoice ${invoice.invoice_number}.`}
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {paymentError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {paymentError}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Invoice Face Value:</span>
              <span className="font-mono font-semibold">
                {money(financial_summary.invoice_amount, financial_summary.currency)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Already Paid:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {money(financial_summary.paid_amount, financial_summary.currency)}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
              <span>Outstanding Balance:</span>
              <span className="font-mono text-rose-700">
                {money(financial_summary.outstanding_amount, financial_summary.currency)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Amount"
              required
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="0.00"
            />
            <Select
              label="Payment Status"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="SUCCEEDED">Succeeded (Settled)</option>
              <option value="PENDING">Pending Settlement</option>
            </Select>
          </div>

          <Input
            label="External Payment Reference (Optional)"
            value={paymentExternalId}
            onChange={(e) => setPaymentExternalId(e.target.value)}
            placeholder="e.g. WIRE-892019 / STRIPE_CH_912"
            helperText="Wire confirmation, transaction hash, or bank reference."
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={paymentLoading}
            >
              Submit Verified Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
