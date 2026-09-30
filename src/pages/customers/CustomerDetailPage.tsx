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
  RefreshCw,
  ShieldAlert,
  User,
} from "lucide-react";
import { customersApi } from "../../api";
import type { CustomerDetail } from "../../types";
import { money, date, dateTime, formatActionType } from "../../lib/utils";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { DetailSkeleton } from "../../components/ui/LoadingSkeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomer = () => {
    setLoading(true);
    setError(null);
    customersApi
      .detail(id)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to load customer details.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  if (loading && !data) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer Profile" backTo="/customers" backLabel="Back to Customers" />
        <ErrorState message={error || "Customer record not found"} retry={fetchCustomer} />
      </div>
    );
  }

  const { customer, summary, invoices, payments, conversations, collection_actions } = data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={customer.name}
        description={customer.company_name ? `${customer.company_name} · Debtor Account` : "Debtor Account Dossier"}
        backTo="/customers"
        backLabel="Back to Directory"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchCustomer}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Link to="/invoices">
              <Button size="sm" variant="brand" icon={<FileText className="h-3.5 w-3.5" />}>
                Issue Invoice
              </Button>
            </Link>
          </div>
        }
      />

      {/* Customer 360 Financial Exposure Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Invoiced</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink font-mono tabular-nums">
            {money(summary.total_invoiced)}
          </p>
          <p className="mt-1 text-xs text-muted">Across {summary.total_invoices} invoice(s)</p>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Total Collected</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 font-mono tabular-nums">
            {money(summary.total_paid)}
          </p>
          <p className="mt-1 text-xs text-muted">Verified payment settlements</p>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Total Outstanding</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-sky-700 font-mono tabular-nums">
            {money(summary.total_outstanding)}
          </p>
          <p className="mt-1 text-xs text-muted">Active open receivable exposure</p>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-800">Overdue Balance</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-700 font-mono tabular-nums">
            {money(summary.overdue_amount)}
          </p>
          <p className="mt-1 text-xs text-muted">Past maturity date balance</p>
        </div>
      </div>

      {/* Main Grid: Details, Invoices, Payments, Communications */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          {/* Customer Invoices Ledger */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Invoices Issued</CardTitle>
                <CardDescription>
                  Full accounts receivable history for this customer.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {invoices && invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Maturity Due</TableHead>
                      <TableHead align="right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell mono>
                          <Link
                            to={`/invoices/${inv.id}`}
                            className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                          >
                            {inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell>{date(inv.due_at)}</TableCell>
                        <TableCell align="right" mono>
                          <span className="font-bold">{money(inv.amount, inv.currency)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge value={inv.status} kind="invoice" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="p-6 text-center text-xs text-muted">
                  No invoices issued to this customer account yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Customer Payments History */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Verified settlement receipts credited to invoices.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {payments && payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recorded</TableHead>
                      <TableHead align="right">Transaction ID</TableHead>
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
                  No payment records found for this customer.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Profile & Collection Actions */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-muted block font-medium">Billing Email</span>
                <div className="flex items-center gap-2 text-ink font-medium">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="hover:underline text-brand-700">
                    {customer.email}
                  </a>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-line/60">
                <span className="text-muted block font-medium">Phone</span>
                <div className="flex items-center gap-2 text-ink">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{customer.phone || "Not recorded"}</span>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-line/60">
                <span className="text-muted block font-medium">Organization / Entity</span>
                <div className="flex items-center gap-2 text-ink">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  <span>{customer.company_name || "Individual"}</span>
                </div>
              </div>

              {customer.external_customer_id && (
                <div className="space-y-1 pt-2 border-t border-line/60">
                  <span className="text-muted block font-medium">External CRM Reference</span>
                  <span className="font-mono text-ink">{customer.external_customer_id}</span>
                </div>
              )}

              <div className="space-y-1 pt-2 border-t border-line/60">
                <span className="text-muted block font-medium">Account Created</span>
                <span className="text-ink">{date(customer.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Conversations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Conversations</CardTitle>
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
                      <div className="flex items-center gap-2">
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
                <p className="text-xs text-muted">No active conversations with this customer.</p>
              )}
            </CardContent>
          </Card>

          {/* Collection Actions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Collection Actions</CardTitle>
              <Link to="/collection-actions" className="text-xs text-brand-700 hover:underline">
                All
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {collection_actions && collection_actions.length > 0 ? (
                collection_actions.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between rounded-lg border border-line p-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-ink">{formatActionType(act.action_type)}</p>
                      <p className="text-[10px] text-muted">{date(act.scheduled_at)}</p>
                    </div>
                    <Badge value={act.status} kind="action" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted">No collection actions assigned to this customer.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
