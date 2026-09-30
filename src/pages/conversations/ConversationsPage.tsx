import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { conversationsApi, customersApi, invoicesApi } from "../../api";
import type { Conversation, Customer, Invoice } from "../../types";
import { date, dateTime, titleCase } from "../../lib/utils";
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

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");

  // Create Conversation Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "",
    invoice_id: "",
    channel: "EMAIL",
    external_thread_id: "",
  });

  const loadData = () => {
    setLoading(true);
    setError(null);
    Promise.all([conversationsApi.list(), customersApi.list(), invoicesApi.list()])
      .then(([convRes, custRes, invRes]) => {
        setConversations(convRes);
        setCustomers(custRes);
        setInvoices(invRes);
      })
      .catch((err) => {
        setError(err.message || "Failed to load conversations inbox.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const customer = customers.find((cust) => cust.id === c.customer_id);
      const matchesQuery =
        (customer?.name || "").toLowerCase().includes(query.toLowerCase()) ||
        (customer?.company_name || "").toLowerCase().includes(query.toLowerCase()) ||
        c.channel.toLowerCase().includes(query.toLowerCase()) ||
        c.status.toLowerCase().includes(query.toLowerCase());

      if (!matchesQuery) return false;

      if (channelFilter !== "ALL") {
        return c.channel.toUpperCase() === channelFilter;
      }

      return true;
    });
  }, [conversations, customers, query, channelFilter]);

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_id || !form.channel) {
      setCreateError("Customer and communication channel are required.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await conversationsApi.create({
        customer_id: form.customer_id,
        invoice_id: form.invoice_id || null,
        channel: form.channel,
        external_thread_id: form.external_thread_id || undefined,
      });
      setModalOpen(false);
      setForm({
        customer_id: "",
        invoice_id: "",
        channel: "EMAIL",
        external_thread_id: "",
      });
      loadData();
    } catch (err: any) {
      setCreateError(err.message || "Failed to start conversation thread.");
    } finally {
      setCreateLoading(false);
    }
  };

  const channelTabs = [
    { id: "ALL", label: "All Channels" },
    { id: "EMAIL", label: "Email" },
    { id: "SMS", label: "SMS" },
    { id: "WHATSAPP", label: "WhatsApp" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections Communications Inbox"
        description="Unified thread inbox for debtor outreach, replies, and AI message intent interpretation."
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
                  customer_id: customers[0]?.id || "",
                }));
              }}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              New Thread
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={channelTabs}
          activeTab={channelFilter}
          onChange={setChannelFilter}
          size="sm"
        />

        <div className="w-full sm:max-w-xs">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search debtor or channel..."
          />
        </div>
      </div>

      {/* Conversations Table */}
      {loading && conversations.length === 0 ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <ErrorState message={error} retry={loadData} />
      ) : filteredConversations.length === 0 ? (
        <EmptyState
          title="No conversations found"
          description={
            query
              ? `No communication threads match "${query}".`
              : "No customer collection threads created yet. Start a new conversation to communicate with a debtor."
          }
          action={
            <Button
              size="sm"
              variant="brand"
              onClick={() => setModalOpen(true)}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              Start New Thread
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-line bg-white shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Linked Invoice</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Timeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConversations.map((c) => {
                const customer = customers.find((cust) => cust.id === c.customer_id);
                const invoice = invoices.find((inv) => inv.id === c.invoice_id);

                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {customer ? (
                        <div>
                          <Link
                            to={`/conversations/${c.id}`}
                            className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                          >
                            {customer.name}
                          </Link>
                          {customer.company_name && (
                            <span className="block text-xs text-muted mt-0.5">
                              {customer.company_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Unlinked Customer</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                        <span>{titleCase(c.channel)}</span>
                      </span>
                    </TableCell>
                    <TableCell mono>
                      {invoice ? (
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="text-xs text-ink hover:text-brand-700 hover:underline"
                        >
                          {invoice.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">Account-level</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted">{dateTime(c.updated_at || c.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge value={c.status} kind="generic" />
                    </TableCell>
                    <TableCell align="right">
                      <Link
                        to={`/conversations/${c.id}`}
                        className="inline-flex items-center gap-1 rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Open Timeline
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Start New Conversation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Start Collections Conversation Thread"
        description="Initiate a dedicated communication thread for receivables follow-up."
        maxWidth="md"
      >
        <form onSubmit={handleCreateConversation} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              {createError}
            </div>
          )}

          <Select
            label="Target Debtor Customer"
            required
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          >
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company_name ? `(${c.company_name})` : ""}
              </option>
            ))}
          </Select>

          <Select
            label="Linked Invoice (Optional)"
            value={form.invoice_id}
            onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
          >
            <option value="">No specific invoice (Account level)</option>
            {invoices
              .filter((inv) => !form.customer_id || inv.customer_id === form.customer_id)
              .map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — Due: {date(inv.due_at)} ({inv.status})
                </option>
              ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Communication Channel"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PORTAL">Customer Portal</option>
            </Select>

            <Input
              label="External Thread Ref (Optional)"
              value={form.external_thread_id}
              onChange={(e) => setForm({ ...form, external_thread_id: e.target.value })}
              placeholder="e.g. THREAD-9012"
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
              Create Thread
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
