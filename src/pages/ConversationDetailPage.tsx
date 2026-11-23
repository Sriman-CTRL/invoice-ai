import { Link, useParams } from "react-router-dom";
import { conversationsApi } from "../api";
import { Badge, EmptyState, PageHeader } from "../components";
import { dateTime, money, titleCase } from "../lib";
import type { Conversation, ConversationDetail, Customer, Invoice } from "../types";
import { useResource, DetailLoad, ActionsTable } from "./shared";

export function ConversationDetailPage() {
  const { id = "" } = useParams();
  const r = useResource(() => conversationsApi.detail(id), [id]);

  return (
    <DetailLoad resource={r}>
      {(data: ConversationDetail) => (
        <>
          <PageHeader
            title="Conversation Thread"
            detail={`${titleCase(data.conversation.channel)} channel · AI intent classified`}
            back="/conversations"
            actions={<Badge value={data.conversation.status} />}
          />

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            {/* Chat View */}
            <section className="panel overflow-hidden flex flex-col">
              <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Message History
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    AI assistant (beta)
                  </span>
                </div>
              </div>

              <div className="space-y-6 p-6 flex-1">
                {data.messages.length ? (
                  data.messages.map((m) => {
                    const isOutbound = m.direction === "OUTBOUND";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-4.5 shadow-soft ${
                            isOutbound
                              ? "bg-gradient-to-tr from-brand-600 to-indigo-700 text-white rounded-tr-sm"
                              : "border border-slate-200/80 bg-white text-slate-800 rounded-tl-sm"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-4 text-[11px]">
                            <span
                              className={`font-bold uppercase tracking-wider ${
                                isOutbound ? "text-brand-100" : "text-slate-400"
                              }`}
                            >
                              {isOutbound ? "You" : "Customer Reply"}
                            </span>
                            <span className={isOutbound ? "text-brand-200" : "text-slate-400"}>
                              {dateTime(m.created_at)}
                            </span>
                          </div>

                          {m.subject && (
                            <p
                              className={`mb-2 font-bold text-sm ${
                                isOutbound ? "text-white" : "text-slate-900"
                              }`}
                            >
                              {m.subject}
                            </p>
                          )}

                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {m.body || "No text content recorded."}
                          </p>

                          {/* AI Intent Diagnostic Tag */}
                          {m.ai_intent && (
                            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                              <span className="text-[11px] font-bold text-slate-400">AI Intent:</span>
                              <Badge value={m.ai_intent} kind="intent" />
                              {m.ai_confidence && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                                  {Math.round(Number(m.ai_confidence) * 100)}% match
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No messages in thread"
                    detail="Messages will be displayed as soon as they are received or dispatched."
                  />
                )}
              </div>
            </section>

            {/* Sidebar Context */}
            <aside className="space-y-6">
              <section className="panel p-6">
                <h3 className="font-bold text-slate-900 mb-4">Customer Context</h3>
                <Link
                  to={`/customers/${data.customer.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-slate-100 p-3.5 transition-colors hover:bg-slate-50"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">
                    {data.customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-slate-900">
                      {data.customer.name}
                    </span>
                    <span className="block text-xs text-slate-400 font-mono">
                      {data.customer.email}
                    </span>
                  </div>
                </Link>
              </section>

              {data.invoice && (
                <section className="panel p-6">
                  <h3 className="font-bold text-slate-900 mb-3">Linked Invoice</h3>
                  <Link
                    to={`/invoices/${data.invoice.id}`}
                    className="block rounded-xl border border-slate-100 p-3.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-brand-600 text-sm">
                        {data.invoice.invoice_number}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {money(data.invoice.amount, data.invoice.currency)}
                      </span>
                    </div>
                  </Link>
                </section>
              )}

              <ActionsTable actions={data.collection_actions} />
            </aside>
          </div>
        </>
      )}
    </DetailLoad>
  );
}
