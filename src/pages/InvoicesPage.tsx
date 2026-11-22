import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, ChevronRight, Download, FileSpreadsheet, FileText, Lock, Phone, Plus, RefreshCw, Search, Upload, X } from "lucide-react";
import { customersApi, invoicesApi } from "../api";
import { Badge, EmptyState, ErrorState, PageHeader, SearchInput, TableSkeleton } from "../components";
import { date, money } from "../lib";
import type { Customer, Invoice } from "../types";
import { useToast } from "../toast";
import { useResource } from "./shared";

function downloadSampleCSV() {
  const csvContent =
    "Customer Name,Customer Email,Company Name,Phone,Invoice Number,Amount,Currency,Due Date,Issue Date\n" +
    "Pixelwave Media,billing@pixelwave.in,Pixelwave Media Private Limited,+91 98200 10001,INV-3001,45000,INR,2026-12-15,2026-11-15\n" +
    "Nexus Cloud Solutions,accounts@nexuscloud.io,Nexus Cloud Corp,+1 415-555-0142,INV-3002,125000,INR,2026-11-30,2026-10-31\n" +
    "Hyperion Retail,finance@hyperionretail.com,Hyperion Retail Group,+91 98111 20002,INV-3003,78500,INR,2026-12-05,2026-11-05";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "invoices_sample_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        insideQuote = !insideQuote;
      } else if ((c === "," || c === "\t" || c === ";") && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += c;
      }
    }
    row.push(entry.trim());
    return row.map((r) => r.replace(/^"|"$/g, "").trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());

  const findCol = (...names: string[]) => {
    return headers.findIndex((h) => names.some((n) => h.includes(n)));
  };

  const nameIdx = findCol("customer name", "client name", "name");
  const emailIdx = findCol("customer email", "email", "mail");
  const companyIdx = findCol("company", "organization");
  const phoneIdx = findCol("phone", "mobile", "contact");
  const invNumIdx = findCol("invoice number", "invoice #", "invoice_number", "inv #", "invoice");
  const amountIdx = findCol("amount", "total", "balance", "price");
  const currencyIdx = findCol("currency");
  const dueIdx = findCol("due date", "due_date", "due_at", "due");
  const issuedIdx = findCol("issue date", "issued_at", "issued", "issue");
  const statusIdx = findCol("status");

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || cols.every((c) => !c)) continue;

    const email = emailIdx >= 0 ? cols[emailIdx] : "";
    const invNum = invNumIdx >= 0 ? cols[invNumIdx] : "";
    const rawAmt = amountIdx >= 0 ? cols[amountIdx].replace(/[^0-9.]/g, "") : "";
    const amount = parseFloat(rawAmt);
    const dueDate = dueIdx >= 0 ? cols[dueIdx] : "";
    const issuedDate = issuedIdx >= 0 ? cols[issuedIdx] : "";
    const name = nameIdx >= 0 ? cols[nameIdx] : "";
    const company = companyIdx >= 0 ? cols[companyIdx] : "";
    const phone = phoneIdx >= 0 ? cols[phoneIdx] : "";
    const currency = currencyIdx >= 0 && cols[currencyIdx] ? cols[currencyIdx].toUpperCase() : "INR";
    const status = statusIdx >= 0 && cols[statusIdx] ? cols[statusIdx].toUpperCase() : "OPEN";

    results.push({
      customer_name: name || company || (email ? email.split("@")[0] : "Customer"),
      customer_email: email,
      company_name: company || null,
      phone: phone || null,
      invoice_number: invNum,
      amount,
      currency,
      due_at: dueDate,
      issued_at: issuedDate || new Date().toISOString().split("T")[0],
      status,
      isValid: Boolean(email && email.includes("@") && invNum && !isNaN(amount) && amount > 0 && dueDate),
    });
  }
  return results;
}
function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported_count: number;
    customers_created: number;
    skipped_count: number;
    errors: string[];
  } | null>(null);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setError("No valid invoice rows found in the CSV. Make sure headers and data rows exist.");
        } else {
          setRows(parsed);
        }
      } catch (err: any) {
        setError("Failed to parse file: " + err.message);
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(selected);
  };

  const validRows = rows.filter((r) => r.isValid);
  const totalAmount = validRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const res = await invoicesApi.bulkImport(
        validRows.map((r) => ({
          customer_name: r.customer_name,
          customer_email: r.customer_email,
          company_name: r.company_name,
          phone: r.phone,
          invoice_number: r.invoice_number,
          amount: r.amount,
          currency: r.currency,
          due_at: r.due_at,
          issued_at: r.issued_at,
          status: r.status,
        }))
      );
      setImportResult(res);
      toast.success("Import complete", `${res.imported_count} invoice(s) imported.`);
      onSuccess();
    } catch (err: any) {
      toast.error("Import failed", err?.message);
      setError(err?.message || "Failed to import invoices");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">1-Click Bulk Invoice Importer</h3>
              <p className="text-xs text-slate-500">
                Upload a CSV export from Excel, Tally, Zoho Books, or QuickBooks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {importResult ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Import Completed Successfully!</h4>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>{importResult.imported_count}</strong> invoices imported,{" "}
                  <strong>{importResult.customers_created}</strong> customer accounts auto-created
                  {importResult.skipped_count > 0 && `, ${importResult.skipped_count} duplicate invoices skipped`}
                  .
                </p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3 text-left rounded-lg bg-white/80 p-3 border border-emerald-200 text-xs text-slate-600 max-h-32 overflow-y-auto font-mono">
                  <div className="font-bold text-slate-700 mb-1">Notices:</div>
                  {importResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Close & View Receivables
              </button>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div className="relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:border-brand-500 hover:bg-brand-50/30 transition-all">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-soft text-brand-600">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-brand-600 hover:underline">
                      Click to choose CSV
                    </span>{" "}
                    or drag and drop your file here
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports .csv exports from Excel, Tally, Zoho Books, or QuickBooks (up to 500 rows)
                  </p>
                </div>
              </div>

              {/* Sample Template helper */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span>Need an example spreadsheet format?</span>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="inline-flex items-center gap-1.5 font-bold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Sample CSV Template
                </button>
              </div>

              {/* Parsed Preview Table */}
              {rows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-900">
                        Preview: {rows.length} rows parsed
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        {validRows.length} valid
                      </span>
                      {rows.length - validRows.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                          {rows.length - validRows.length} invalid
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold font-mono text-slate-900">
                      Total: {money(totalAmount)}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 text-xs">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Invoice #</th>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2">Due Date</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={r.isValid ? "hover:bg-slate-50" : "bg-rose-50/40"}>
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">
                              {r.invoice_number || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="px-3 py-2">{r.customer_name}</td>
                            <td className="px-3 py-2 text-slate-500 font-mono">
                              {r.customer_email || <span className="text-rose-500 italic">Missing</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold">
                              {isNaN(r.amount) ? "—" : money(r.amount, r.currency)}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.due_at || "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {r.isValid ? (
                                <span className="text-emerald-600 font-bold">✓ Ready</span>
                              ) : (
                                <span className="text-rose-500 font-bold">✕ Invalid</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validRows.length === 0 || importing}
              onClick={handleImport}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Importing Invoices...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import {validRows.length} Invoices
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function CreateInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerCompany, setNewCustomerCompany] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const [dueAt, setDueAt] = useState(defaultDue.toISOString().split("T")[0]);
  const [deliverableVaultUrl, setDeliverableVaultUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    customersApi
      .list()
      .then((res) => {
        setCustomers(res);
        if (res.length > 0) {
          setCustomerId(res[0].id);
        } else {
          setIsNewCustomer(true);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!invoiceNumber.trim()) {
      setError("Invoice number is required.");
      return;
    }

    setSaving(true);
    try {
      let finalCustomerId = customerId;
      if (isNewCustomer) {
        if (!newCustomerEmail.trim() || !newCustomerEmail.includes("@")) {
          throw new Error("Valid customer email is required.");
        }
        const createdCustomer = await customersApi.create({
          name: newCustomerName.trim() || newCustomerEmail.split("@")[0],
          email: newCustomerEmail.trim().toLowerCase(),
          company_name: newCustomerCompany.trim() || undefined,
          phone: newCustomerPhone.trim() || undefined,
        });
        finalCustomerId = createdCustomer.id;
      }

      await invoicesApi.create({
        customer_id: finalCustomerId,
        invoice_number: invoiceNumber.trim(),
        amount: numAmount,
        currency,
        issued_at: issuedAt,
        due_at: dueAt,
        external_invoice_id: deliverableVaultUrl.trim() ? `vault:${deliverableVaultUrl.trim()}` : undefined,
      });

      toast.success("Invoice created", invoiceNumber.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Could not create invoice", err?.message);
      setError(err?.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-6 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Create New Invoice</h3>
              <p className="text-xs text-slate-500">Record a new balance in the ledger.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Customer</label>
              {customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNewCustomer(!isNewCustomer)}
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  {isNewCustomer ? "Select existing customer" : "+ Add new customer"}
                </button>
              )}
            </div>

            {isNewCustomer ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder="billing@acme.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Company Name</label>
                    <input
                      type="text"
                      value={newCustomerCompany}
                      onChange={(e) => setNewCustomerCompany(e.target.value)}
                      placeholder="Acme Inc"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Phone</label>
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="+91 98..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none bg-white"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company_name || c.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Invoice # & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Invoice Number</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-1001"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Amount</label>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold bg-white"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                  <option value="GBP">£ GBP</option>
                </select>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Issued Date</label>
              <input
                type="date"
                required
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Due Date</label>
              <input
                type="date"
                required
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Deliverable Vault Escrow Lock (Fix My Itch: Freelancer Ghosting & SME Cashflow Shield) */}
          <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-600/10 text-indigo-600">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Zero-Cost Deliverable Vault (Escrow Lock)</p>
                <p className="text-[10px] text-slate-500">Lock work deliverables until client completes settlement</p>
              </div>
            </div>
            <input
              type="url"
              value={deliverableVaultUrl}
              onChange={(e) => setDeliverableVaultUrl(e.target.value)}
              placeholder="e.g. Figma file, Google Drive, GitHub repo, or Dropbox URL"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              When attached, client sees a locked vault card on their checkout page. Once payment is verified, the deliverables unlock instantly with zero gateway transaction fees.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const resource = useResource(() => invoicesApi.list(status || undefined), [status]);

  const invoices = useMemo(
    () =>
      (resource.data || []).filter((invoice) =>
        `${invoice.invoice_number} ${invoice.customers?.name || ""} ${invoice.customers?.email || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [resource.data, query],
  );

  const tabs = [
    { id: "", label: "All" },
    { id: "OPEN", label: "Open" },
    { id: "PARTIALLY_PAID", label: "Partially Paid" },
    { id: "PAID", label: "Paid" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <>
      <PageHeader
        title="Receivables Ledger"
        detail="Manage invoice balances, payment schedules, and automated collection actions."
        actions={
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-semibold text-slate-500 hidden sm:inline mr-1">
              {invoices.length} {invoices.length === 1 ? "record" : "records"}
            </span>
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Invoice</span>
            </button>
          </div>
        }
      />

      {/* Filter Tabs & Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1 shadow-soft">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                status === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search invoice or customer..."
          />
        </div>
      </div>

      {resource.loading ? (
        <TableSkeleton rows={6} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices found"
          detail="There are no records matching your selected status and search query."
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="table-head">Invoice ID</th>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Issued</th>
                  <th className="table-head">Due Date</th>
                  <th className="table-head text-right">Amount</th>
                  <th className="table-head text-center">Status</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-mono font-bold text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                        {inv.external_invoice_id && (inv.external_invoice_id.startsWith("vault:") || inv.external_invoice_id.startsWith("http")) && (
                          <span
                            title={inv.status === "PAID" ? "Deliverable Vault Unlocked" : "Deliverable Held in Escrow Vault"}
                            className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              inv.status === "PAID"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : "text-indigo-700 bg-indigo-50 border-indigo-200"
                            }`}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {inv.status === "PAID" ? "Vault Unlocked" : "Vault"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="font-semibold text-slate-900">
                        {inv.customers?.name || "Unknown Customer"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {inv.customers?.company_name || inv.customers?.email || "—"}
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {date(inv.issued_at)}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">
                      {date(inv.due_at)}
                    </td>
                    <td className="table-cell text-right font-mono font-bold text-slate-900">
                      {money(inv.amount, inv.currency)}
                    </td>
                    <td className="table-cell text-center">
                      <Badge value={inv.status} />
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        <a
                          href={`/pay/${inv.invoice_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open public payment portal"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          <span>Portal</span>
                        </a>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-brand-600"
                        >
                          <span>Details</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BulkImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => resource.reload()}
      />
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => resource.reload()}
      />
    </>
  );
}
