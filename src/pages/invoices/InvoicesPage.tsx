import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpDown,
  FilePlus,
  FileText,
  Filter,
  Plus,
  RefreshCw,
} from "lucide-react";
import { customersApi, invoicesApi } from "../../api";
import type { Customer, Invoice } from "../../types";
import { money, date, cn } from "../../lib/utils";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { Tabs } from "../../components/ui/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"created" | "due" | "amount">("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Create Invoice Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "",
    invoice_number: "",
    amount: "",
    currency: "USD",
    issued_at: new Date().toISOString().split("T")[0],
    due_at: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    status: "OPEN",
    external_invoice_id: "",
  });

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      invoicesApi.list(statusFilter === "ALL" ? undefined : statusFilter === "OVERDUE" ? undefined : statusFilter),
      customersApi.list(),
    ])
      .then(([invRes, custRes]) => {
        setInvoices(invRes);
        setCustomers(custRes);
      })
      .catch((err) => {
        setError(err.message || "Failed to load invoices.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Client-side filtering & sorting
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    return invoices
      .filter((inv) => {
        const matchesQuery =
          inv.invoice_number.toLowerCase().includes(query.toLowerCase()) ||
          (inv.customers?.name || "").toLowerCase().includes(query.toLowerCase()) ||
          (inv.customers?.company_name || "").toLowerCase().includes(query.toLowerCase());

        if (!matchesQuery) return false;

        if (statusFilter === "OVERDUE") {
          const isPastDue = inv.due_at && new Date(inv.due_at) < now;
          return isPastDue && (inv.status === "OPEN" || inv.status === "PARTIALLY_PAID");
        }

        if (statusFilter !== "ALL") {
          return inv.status === statusFilter;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "amount") {
          const amtA = Number(a.amount || 0);
          const amtB = Number(b.amount || 0);
          return sortOrder === "asc" ? amtA - amtB : amtB - amtA;
        }
        if (sortBy === "due") {
          const dueA = a.due_at ? new Date(a.due_at).getTime() : 0;
          const dueB = b.due_at ? new Date(b.due_at).getTime() : 0;
          return sortOrder === "asc" ? dueA - dueB : dueB - dueA;
        }
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
  }, [invoices, query, statusFilter, sortBy, sortOrder]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id || !form.invoice_number || !form.amount) {
      setCreateError("Customer, invoice number, and amount are required.");
      return;
    }
    const numericAmount = parseFloat(form.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setCreateError("Please enter a valid positive invoice amount.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await invoicesApi.create({
        customer_id: form.customer_id,
        invoice_number: form.invoice_number,
        amount: numericAmount,
        currency: form.currency || "USD",
        issued_at: form.issued_at,
        due_at: form.due_at,
        status: form.status,
        external_invoice_id: form.external_invoice_id || undefined,
      });
      setModalOpen(false);
      setForm({
        customer_id: "",
        invoice_number: "",
        amount: "",
        currency: "USD",
        issued_at: new Date().toISOString().split("T")[0],
        due_at: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
        status: "OPEN",
        external_invoice_id: "",
      });
      loadData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create invoice.");
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleSort = (field: "created" | "due" | "amount") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const statusTabs = [
    { id: "ALL", label: "All Invoices" },
    { id: "OPEN", label: "Open" },
    { id: "PARTIALLY_PAID", label: "Partially Paid" },
    { id: "PAID", label: "Paid" },
    { id: "OVERDUE", label: "Overdue" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Invoices Ledger"
        description="Authoritative records of accounts receivable balances, maturity dates, and payment states."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={loadData}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="brand"
              onClick={() => {
                setModalOpen(true);
                setForm((prev) => ({
                  ...prev,
                  invoice_number: `INV-${Date.now().toString().slice(-4)}`,
                  customer_id: customers[0]?.id || "",
                }));
              }}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Issue Invoice
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          tabs={statusTabs}
          activeTab={statusFilter}
          onChange={setStatusFilter}
          size="sm"
        />

        <div className="w-full lg:w-72">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search invoice or debtor..."
          />
        </div>
      </div>

      {/* Invoices Table */}
      {loading && invoices.length === 0 ? (
        <TableSkeleton rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} retry={loadData} />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description={
            query
              ? `No invoices match your search term "${query}".`
              : "No invoices in this status category. Issue an invoice to get started."
          }
          action={
            <Button
              size="sm"
              variant="brand"
              onClick={() => setModalOpen(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Issue New Invoice
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-white shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>
                  <button
                    onClick={() => toggleSort("due")}
                    className="inline-flex items-center gap-1 hover:text-ink transition-colors"
                  >
                    <span>Due Date</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead align="right">
                  <button
                    onClick={() => toggleSort("amount")}
                    className="inline-flex items-center gap-1 hover:text-ink transition-colors ml-auto"
                  >
                    <span>Total Amount</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => {
                const isOverdue =
                  Boolean(inv.due_at && new Date(inv.due_at) < new Date()) &&
                  (inv.status === "OPEN" || inv.status === "PARTIALLY_PAID");

                return (
                  <TableRow key={inv.id}>
                    <TableCell mono>
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                      {inv.external_invoice_id && (
                        <span className="block text-[11px] text-muted font-sans mt-0.5">
                          Ext: {inv.external_invoice_id}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {inv.customers ? (
                        <div>
                          <Link
                            to={`/customers/${inv.customer_id}`}
                            className="font-medium text-ink hover:text-brand-700 transition-colors"
                          >
                            {inv.customers.name}
                          </Link>
                          {inv.customers.company_name && (
                            <span className="block text-xs text-muted mt-0.5">
                              {inv.customers.company_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn(isOverdue ? "text-rose-700 font-semibold" : "")}>
                        {date(inv.due_at)}
                      </span>
                      {isOverdue && (
                        <span className="block text-[10px] text-rose-600 font-medium">
                          Past due
                        </span>
                      )}
                    </TableCell>
                    <TableCell align="right" mono>
                      <span className="font-bold">{money(inv.amount, inv.currency)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge value={inv.status} kind="invoice" isOverdue={isOverdue} />
                    </TableCell>
                    <TableCell align="right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="inline-flex items-center gap-1 rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        Inspect
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Table Footer Summary */}
          <div className="flex items-center justify-between border-t border-line/60 bg-slate-50/50 px-5 py-3 text-xs text-muted">
            <span>
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </span>
            <span className="font-mono tabular-nums">
              Filter: {statusFilter}
            </span>
          </div>
        </div>
      )}

      {/* Issue Invoice Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Issue New Invoice"
        description="Generate an accounts receivable invoice for an existing debtor customer."
        maxWidth="md"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {createError}
            </div>
          )}

          <Select
            label="Customer Debtor"
            required
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          >
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company_name ? `(${c.company_name})` : ""} — {c.email}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Invoice Number"
              required
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              placeholder="INV-2026-XXXX"
            />
            <Input
              label="External ID (Optional)"
              value={form.external_invoice_id}
              onChange={(e) => setForm({ ...form, external_invoice_id: e.target.value })}
              placeholder="e.g. ERP-1092"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              <option value="USD">USD ($)</option>
              <option value="INR">INR (₹)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Issue Date"
              type="date"
              required
              value={form.issued_at}
              onChange={(e) => setForm({ ...form, issued_at: e.target.value })}
            />
            <Input
              label="Due Date"
              type="date"
              required
              value={form.due_at}
              onChange={(e) => setForm({ ...form, due_at: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={createLoading}
            >
              Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
