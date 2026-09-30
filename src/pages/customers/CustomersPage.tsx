import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  Users,
} from "lucide-react";
import { customersApi } from "../../api";
import type { Customer } from "../../types";
import { date, initials } from "../../lib/utils";
import { Button } from "../../components/ui/Button";
import { SearchInput } from "../../components/ui/SearchInput";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Create Customer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company_name: "",
    phone: "",
    external_customer_id: "",
  });

  const loadCustomers = () => {
    setLoading(true);
    setError(null);
    customersApi
      .list()
      .then((res) => {
        setCustomers(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to load customers.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.company_name || "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.external_customer_id || "").toLowerCase().includes(q)
      );
    });
  }, [customers, query]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setCreateError("Customer name and email are required.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await customersApi.create({
        name: form.name,
        email: form.email,
        company_name: form.company_name || undefined,
        phone: form.phone || undefined,
        external_customer_id: form.external_customer_id || undefined,
      });
      setModalOpen(false);
      setForm({
        name: "",
        email: "",
        company_name: "",
        phone: "",
        external_customer_id: "",
      });
      loadCustomers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create customer.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Directory"
        description="Comprehensive debtor accounts database, contact references, and receivables 360° dossiers."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={loadCustomers}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="brand"
              onClick={() => setModalOpen(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Debtor Account
            </Button>
          </div>
        }
      />

      {/* Search Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name, company, or email..."
          />
        </div>
        <p className="text-xs text-muted">
          Showing {filteredCustomers.length} of {customers.length} debtors
        </p>
      </div>

      {/* Customers Table */}
      {loading && customers.length === 0 ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} retry={loadCustomers} />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description={
            query
              ? `No debtors match your search query "${query}".`
              : "No customer records registered in this organization. Add a customer to link invoices and collection workflows."
          }
          action={
            <Button
              size="sm"
              variant="brand"
              onClick={() => setModalOpen(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Add Debtor Account
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-white shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Organization / Company</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead align="right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 font-bold text-xs text-slate-700 shrink-0">
                        {initials(c.name)}
                      </div>
                      <div>
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                        >
                          {c.name}
                        </Link>
                        {c.external_customer_id && (
                          <span className="block text-[11px] text-muted font-mono mt-0.5">
                            ID: {c.external_customer_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">
                      {c.company_name || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600">{c.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-slate-600">{c.phone || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted">{date(c.created_at)}</span>
                  </TableCell>
                  <TableCell align="right">
                    <Link
                      to={`/customers/${c.id}`}
                      className="inline-flex items-center gap-1 rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      360° Dossier
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Debtor Customer Account"
        description="Register a new customer profile for invoice generation and collections follow-up."
        maxWidth="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {createError}
            </div>
          )}

          <Input
            label="Customer Full Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. John Doe / Apex Finance"
            prefixIcon={<User className="h-4 w-4" />}
          />

          <Input
            label="Billing Email"
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="billing@customer.com"
            prefixIcon={<Mail className="h-4 w-4" />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company Name"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              placeholder="e.g. Apex Dynamics Ltd"
              prefixIcon={<Building2 className="h-4 w-4" />}
            />
            <Input
              label="Phone Number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1-555-0199"
              prefixIcon={<Phone className="h-4 w-4" />}
            />
          </div>

          <Input
            label="External Customer Reference (Optional)"
            value={form.external_customer_id}
            onChange={(e) => setForm({ ...form, external_customer_id: e.target.value })}
            placeholder="e.g. CRM-1002"
            helperText="Internal identifier from your CRM or ERP system."
          />

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
              Register Debtor Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
