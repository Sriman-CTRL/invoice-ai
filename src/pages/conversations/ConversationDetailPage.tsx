import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import { conversationsApi, messagesApi } from "../../api";
import type { ConversationDetail, Message } from "../../types";
import { money, date, dateTime, formatActionType, titleCase, cn } from "../../lib/utils";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { DetailSkeleton } from "../../components/ui/LoadingSkeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeader } from "../../components/ui/PageHeader";

export function ConversationDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Send message reply state
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // AI Classification state per message
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [classifyResultNotice, setClassifyResultNotice] = useState<string | null>(null);

  const fetchConversation = () => {
    setLoading(true);
    setError(null);
    conversationsApi
      .detail(id)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to load conversation thread.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchConversation();
  }, [id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    setSending(true);
    setSendError(null);
    try {
      await messagesApi.create({
        conversation_id: id,
        direction: "OUTBOUND",
        channel: data?.conversation.channel || "EMAIL",
        sender: "collections@ledgerlane.com",
        recipient: data?.customer.email,
        subject: replySubject.trim() || undefined,
        body: replyBody.trim(),
      });
      setReplyBody("");
      setReplySubject("");
      fetchConversation();
    } catch (err: any) {
      setSendError(err.message || "Failed to send outbound message.");
    } finally {
      setSending(false);
    }
  };

  const handleClassifyMessage = async (messageId: string) => {
    setClassifyingId(messageId);
    setClassifyResultNotice(null);
    try {
      const res = await messagesApi.classify(messageId);
      const actionCreated = res.collection_action?.action_created;
      const actionType = res.collection_action?.action_type;

      setClassifyResultNotice(
        `Classified as "${res.classification.intent}" (${Math.round(
          res.classification.confidence * 100
        )}% confidence). ${
          actionCreated ? `Generated collection action: ${formatActionType(actionType)}.` : ""
        }`
      );
      fetchConversation();
    } catch (err: any) {
      setClassifyResultNotice(`Classification failed: ${err.message || "Engine error"}`);
    } finally {
      setClassifyingId(null);
    }
  };

  if (loading && !data) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Conversation Timeline"
          backTo="/conversations"
          backLabel="Back to Inbox"
        />
        <ErrorState message={error || "Conversation not found"} retry={fetchConversation} />
      </div>
    );
  }

  const { conversation, customer, invoice, messages, collection_actions } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`${customer.name} · ${titleCase(conversation.channel)} Thread`}
        description={`Status: ${conversation.status} · Channel: ${conversation.channel}`}
        backTo="/conversations"
        backLabel="Back to Inbox"
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={fetchConversation}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh Thread
          </Button>
        }
      />

      {/* Classification result banner */}
      {classifyResultNotice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs sm:text-sm text-emerald-900 shadow-soft">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{classifyResultNotice}</span>
          </div>
          <button
            onClick={() => setClassifyResultNotice(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Advisory Notice Banner */}
      <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
        <Bot className="h-4 w-4 text-slate-500 shrink-0" />
        <span>
          <strong>Advisory AI Interpretation:</strong> AI intent tags classify customer statements into behavioral categories (e.g. payment promised, dispute). Authoritative ledger balance changes require verified settlement records.
        </span>
      </div>

      {/* Main Grid: Message Timeline + Sidebar Context */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-6">
          {/* Message Timeline */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Timeline History</CardTitle>
                <CardDescription>
                  Inbound debtor responses and outbound operational notices.
                </CardDescription>
              </div>
              <Badge value={conversation.status} kind="generic" />
            </CardHeader>

            <CardContent className="space-y-5 p-5">
              {messages && messages.length > 0 ? (
                messages.map((msg) => {
                  const isInbound = msg.direction === "INBOUND";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "rounded-lg border p-4 transition-shadow",
                        isInbound
                          ? "border-slate-200 bg-white"
                          : "border-brand-200 bg-brand-50/40 ml-4 sm:ml-8"
                      )}
                    >
                      {/* Message Meta Header */}
                      <div className="flex items-center justify-between border-b border-line/60 pb-2 mb-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              isInbound
                                ? "bg-slate-100 text-slate-700"
                                : "bg-brand-600 text-white"
                            )}
                          >
                            {isInbound ? "Debtor (Customer)" : "Our Team"}
                          </span>
                          <span className="font-medium text-slate-700 truncate max-w-[160px]">
                            {msg.sender || (isInbound ? customer.email : "Operations")}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted">
                          {dateTime(msg.created_at)}
                        </span>
                      </div>

                      {/* Subject */}
                      {msg.subject && (
                        <p className="font-semibold text-xs text-ink mb-1.5">
                          Subject: {msg.subject}
                        </p>
                      )}

                      {/* Body */}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {msg.body || "No message body provided."}
                      </p>

                      {/* AI Intent Tag / Classification Controls for Inbound */}
                      {isInbound && (
                        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5">
                          {msg.ai_intent ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted">AI Intent:</span>
                              <Badge value={msg.ai_intent} kind="intent" />
                              {msg.ai_confidence && (
                                <span className="font-mono text-xs font-semibold text-slate-500">
                                  {Math.round(Number(msg.ai_confidence) * 100)}% confidence
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted italic">
                              Message has not yet been classified.
                            </span>
                          )}

                          <Button
                            size="sm"
                            variant="secondary"
                            loading={classifyingId === msg.id}
                            onClick={() => handleClassifyMessage(msg.id)}
                            icon={<Sparkles className="h-3 w-3 text-brand-600" />}
                            className="text-xs ml-auto"
                          >
                            {msg.ai_intent ? "Re-classify with AI" : "Classify Intent with AI"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-xs text-muted py-6">
                  No messages recorded in this conversation yet. Send a message below.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Outbound Reply Composer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Send Outbound Message</CardTitle>
              <CardDescription>
                Reply directly to {customer.name} via {conversation.channel}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendMessage} className="space-y-3">
                {sendError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    {sendError}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Subject (Optional)"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="h-9 w-full rounded-md border border-line bg-white px-3 text-xs sm:text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />

                <textarea
                  rows={4}
                  required
                  placeholder={`Write your follow-up message to ${customer.name}...`}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="w-full rounded-md border border-line bg-white p-3 text-xs sm:text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted">
                    Channel: {conversation.channel} · Sent from collections@ledgerlane.com
                  </span>
                  <Button
                    type="submit"
                    variant="brand"
                    size="sm"
                    loading={sending}
                    icon={<Send className="h-3.5 w-3.5" />}
                  >
                    Send Message
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Contextual Debtor & Invoice Cards */}
        <div className="space-y-6">
          {/* Debtor Profile Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Customer Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
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
                    {customer.company_name || "Debtor Account"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-line/60">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-slate-400">Phone:</span>
                    <span>{customer.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Link
                  to={`/customers/${customer.id}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-line bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Customer 360° Profile
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Linked Invoice Card */}
          {invoice && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Linked Invoice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="font-mono text-sm font-bold text-brand-700 hover:underline"
                  >
                    {invoice.invoice_number}
                  </Link>
                  <Badge value={invoice.status} kind="invoice" />
                </div>

                <div className="rounded-lg border border-line bg-slate-50 p-2.5 space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Face Value:</span>
                    <span className="font-mono font-semibold">
                      {money(invoice.amount, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Due Date:</span>
                    <span>{date(invoice.due_at)}</span>
                  </div>
                </div>

                <Link
                  to={`/invoices/${invoice.id}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-line bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Inspect Invoice
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Collection Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Triggered Follow-ups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {collection_actions && collection_actions.length > 0 ? (
                collection_actions.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-lg border border-line p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        {formatActionType(act.action_type)}
                      </span>
                      <Badge value={act.status} kind="action" />
                    </div>
                    <p className="text-[10px] text-muted">
                      Scheduled: {date(act.scheduled_at)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted">
                  No automated collection actions triggered yet in this conversation.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
