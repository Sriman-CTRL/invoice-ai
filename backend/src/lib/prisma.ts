import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

// In-Memory Database Store for AI Studio environment
interface Store {
  organizations: any[];
  users: any[];
  customers: any[];
  invoices: any[];
  payments: any[];
  conversations: any[];
  messages: any[];
  collection_actions: any[];
}

const defaultOrgId = "d3b07384-d113-4966-9c0e-6091398c8c6a";
const defaultUserId = "e4a18295-e224-4a77-ad1f-71a2409d9d7b";
const cust1Id = "c1111111-1111-4111-a111-111111111111";
const cust2Id = "c2222222-2222-4222-a222-222222222222";
const cust3Id = "c3333333-3333-4333-a333-333333333333";
const inv1Id = "11111111-1111-4111-b111-111111111111";
const inv2Id = "22222222-2222-4222-b222-222222222222";
const inv3Id = "33333333-3333-4333-b333-333333333333";
const inv4Id = "44444444-4444-4444-b444-444444444444";
const convo1Id = "f1111111-1111-4111-d111-111111111111";

const now = Date.now();
const day = 86400000;

function createSeedData(): Store {
  return {
    organizations: [
      {
        id: defaultOrgId,
        name: "Acme Financial Corp",
        slug: "acme-financial",
        created_at: new Date(now - 60 * day),
        updated_at: new Date(now - 60 * day),
      },
    ],
    users: [
      {
        id: defaultUserId,
        organization_id: defaultOrgId,
        email: "demo@ledgerlane.com",
        name: "Demo Admin",
        password_hash: bcrypt.hashSync("password123", 10),
        created_at: new Date(now - 60 * day),
        updated_at: new Date(now - 60 * day),
      },
    ],
    customers: [
      {
        id: cust1Id,
        organization_id: defaultOrgId,
        name: "Apex Dynamics Ltd",
        email: "accounts@apexdynamics.io",
        company_name: "Apex Dynamics",
        phone: "+1-555-0192",
        external_customer_id: "EXT-CUST-101",
        created_at: new Date(now - 40 * day),
        updated_at: new Date(now - 40 * day),
      },
      {
        id: cust2Id,
        organization_id: defaultOrgId,
        name: "CloudScale Technologies",
        email: "billing@cloudscale.net",
        company_name: "CloudScale Tech",
        phone: "+1-555-0143",
        external_customer_id: "EXT-CUST-102",
        created_at: new Date(now - 35 * day),
        updated_at: new Date(now - 35 * day),
      },
      {
        id: cust3Id,
        organization_id: defaultOrgId,
        name: "Horizon Logistics",
        email: "pay@horizonlog.com",
        company_name: "Horizon Logistics LLC",
        phone: "+1-555-0188",
        external_customer_id: "EXT-CUST-103",
        created_at: new Date(now - 25 * day),
        updated_at: new Date(now - 25 * day),
      },
    ],
    invoices: [
      {
        id: inv1Id,
        organization_id: defaultOrgId,
        customer_id: cust1Id,
        invoice_number: "INV-2026-001",
        external_invoice_id: "EXT-INV-001",
        amount: 14500.0,
        currency: "USD",
        status: "OPEN",
        issued_at: new Date(now - 30 * day),
        due_at: new Date(now - 10 * day),
        created_at: new Date(now - 30 * day),
        updated_at: new Date(now - 30 * day),
      },
      {
        id: inv2Id,
        organization_id: defaultOrgId,
        customer_id: cust2Id,
        invoice_number: "INV-2026-002",
        external_invoice_id: "EXT-INV-002",
        amount: 32000.0,
        currency: "USD",
        status: "PARTIALLY_PAID",
        issued_at: new Date(now - 45 * day),
        due_at: new Date(now - 5 * day),
        created_at: new Date(now - 45 * day),
        updated_at: new Date(now - 15 * day),
      },
      {
        id: inv3Id,
        organization_id: defaultOrgId,
        customer_id: cust3Id,
        invoice_number: "INV-2026-003",
        external_invoice_id: "EXT-INV-003",
        amount: 8900.0,
        currency: "USD",
        status: "PAID",
        issued_at: new Date(now - 20 * day),
        due_at: new Date(now + 10 * day),
        created_at: new Date(now - 20 * day),
        updated_at: new Date(now - 3 * day),
      },
      {
        id: inv4Id,
        organization_id: defaultOrgId,
        customer_id: cust1Id,
        invoice_number: "INV-2026-004",
        external_invoice_id: "EXT-INV-004",
        amount: 18200.0,
        currency: "USD",
        status: "OPEN",
        issued_at: new Date(now - 5 * day),
        due_at: new Date(now + 15 * day),
        created_at: new Date(now - 5 * day),
        updated_at: new Date(now - 5 * day),
      },
    ],
    payments: [
      {
        id: "d1111111-1111-4111-c111-111111111111",
        organization_id: defaultOrgId,
        invoice_id: inv2Id,
        external_payment_id: "PAY-1001",
        amount: 12000.0,
        currency: "USD",
        status: "SUCCEEDED",
        paid_at: new Date(now - 15 * day),
        created_at: new Date(now - 15 * day),
        updated_at: new Date(now - 15 * day),
      },
      {
        id: "d2222222-2222-4222-c222-222222222222",
        organization_id: defaultOrgId,
        invoice_id: inv3Id,
        external_payment_id: "PAY-1002",
        amount: 8900.0,
        currency: "USD",
        status: "SUCCEEDED",
        paid_at: new Date(now - 3 * day),
        created_at: new Date(now - 3 * day),
        updated_at: new Date(now - 3 * day),
      },
    ],
    conversations: [
      {
        id: convo1Id,
        organization_id: defaultOrgId,
        customer_id: cust1Id,
        invoice_id: inv1Id,
        channel: "EMAIL",
        external_thread_id: "THREAD-001",
        status: "OPEN",
        created_at: new Date(now - 9 * day),
        updated_at: new Date(now - 1 * day),
      },
    ],
    messages: [
      {
        id: "b1111111-1111-4111-e111-111111111111",
        organization_id: defaultOrgId,
        conversation_id: convo1Id,
        direction: "OUTBOUND",
        channel: "EMAIL",
        sender: "billing@acmefinancial.com",
        recipient: "accounts@apexdynamics.io",
        subject: "Overdue Invoice INV-2026-001",
        body: "Friendly reminder that Invoice INV-2026-001 for $14,500 was due 10 days ago. Please let us know when payment will be processed.",
        external_message_id: "MSG-001",
        ai_intent: null,
        ai_confidence: null,
        created_at: new Date(now - 2 * day),
      },
      {
        id: "b2222222-2222-4222-e222-222222222222",
        organization_id: defaultOrgId,
        conversation_id: convo1Id,
        direction: "INBOUND",
        channel: "EMAIL",
        sender: "accounts@apexdynamics.io",
        recipient: "billing@acmefinancial.com",
        subject: "Re: Overdue Invoice INV-2026-001",
        body: "Apologies for the delay! We will pay the $14,500 tomorrow via wire transfer.",
        external_message_id: "MSG-002",
        ai_intent: "PAYMENT_PROMISED",
        ai_confidence: 0.91,
        created_at: new Date(now - 1 * day),
      },
    ],
    collection_actions: [
      {
        id: "a1111111-1111-4111-f111-111111111111",
        organization_id: defaultOrgId,
        customer_id: cust1Id,
        invoice_id: inv1Id,
        conversation_id: convo1Id,
        action_type: "FOLLOW_UP_SCHEDULED",
        status: "PENDING",
        scheduled_at: new Date(now + 1 * day),
        executed_at: null,
        metadata: { reason: "Customer promised payment by tomorrow", ai_intent: "PAYMENT_PROMISED" },
        created_at: new Date(now - 1 * day),
      },
    ],
  };
}

const store = createSeedData();

function matchesFilter(item: any, where: any): boolean {
  if (!where || typeof where !== "object") return true;

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    const itemVal = item[key];

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const condition = value as Record<string, any>;
      if ("in" in condition && Array.isArray(condition.in)) {
        if (!condition.in.includes(itemVal)) return false;
      }
      if ("not" in condition) {
        if (itemVal === condition.not) return false;
      }
      if ("lt" in condition) {
        const itemDate = itemVal instanceof Date ? itemVal.getTime() : new Date(itemVal).getTime();
        const condDate = condition.lt instanceof Date ? condition.lt.getTime() : new Date(condition.lt).getTime();
        if (!(itemDate < condDate)) return false;
      }
      if ("gt" in condition) {
        const itemDate = itemVal instanceof Date ? itemVal.getTime() : new Date(itemVal).getTime();
        const condDate = condition.gt instanceof Date ? condition.gt.getTime() : new Date(condition.gt).getTime();
        if (!(itemDate > condDate)) return false;
      }
      continue;
    }

    if (typeof value === "string" && typeof itemVal === "string") {
      if (itemVal.toLowerCase() !== value.toLowerCase() && itemVal !== value) return false;
      continue;
    }

    if (itemVal !== value) return false;
  }
  return true;
}

function sortItems(items: any[], orderBy: any): any[] {
  if (!orderBy) return items;
  const copy = [...items];

  const orderArray = Array.isArray(orderBy) ? orderBy : [orderBy];

  copy.sort((a, b) => {
    for (const order of orderArray) {
      const [field, direction] = Object.entries(order)[0] as [string, "asc" | "desc"];
      const valA = a[field];
      const valB = b[field];

      if (valA === valB) continue;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      const comp = valA instanceof Date || typeof valA === "number"
        ? (Number(valA) > Number(valB) ? 1 : -1)
        : String(valA).localeCompare(String(valB));

      return direction === "asc" ? comp : -comp;
    }
    return 0;
  });

  return copy;
}

function attachRelations(collection: string, item: any, include: any): any {
  if (!include || typeof include !== "object" || !item) return item;
  const result = { ...item };

  if (collection === "invoices") {
    if (include.customers) {
      result.customers = store.customers.find((c) => c.id === item.customer_id) || null;
    }
  }

  if (collection === "conversations") {
    if (include.customers) {
      result.customers = store.customers.find((c) => c.id === item.customer_id) || null;
    }
    if (include.invoices) {
      result.invoices = store.invoices.find((i) => i.id === item.invoice_id) || null;
    }
    if (include.messages) {
      const msgs = store.messages.filter((m) => m.conversation_id === item.id);
      result.messages = sortItems(msgs, include.messages?.orderBy || { created_at: "asc" });
    }
    if (include.collection_actions) {
      const actions = store.collection_actions.filter((a) => a.conversation_id === item.id);
      result.collection_actions = sortItems(actions, include.collection_actions?.orderBy || { created_at: "desc" });
    }
  }

  if (collection === "collection_actions") {
    if (include.customers) {
      result.customers = store.customers.find((c) => c.id === item.customer_id) || null;
    }
    if (include.invoices) {
      result.invoices = store.invoices.find((i) => i.id === item.invoice_id) || null;
    }
    if (include.conversations) {
      result.conversations = store.conversations.find((c) => c.id === item.conversation_id) || null;
    }
  }

  if (collection === "payments") {
    if (include.invoices) {
      const inv = store.invoices.find((i) => i.id === item.invoice_id);
      if (include.invoices.select?.invoice_number) {
        result.invoices = inv ? { invoice_number: inv.invoice_number } : null;
      } else {
        result.invoices = inv || null;
      }
    }
  }

  return result;
}

function createModelHandler(modelName: keyof Store) {
  return {
    async findMany(args: any = {}) {
      const { where, orderBy, include, select, distinct, take } = args;
      let items = (store[modelName] || []).filter((item) => matchesFilter(item, where));

      if (distinct && Array.isArray(distinct)) {
        const seen = new Set();
        items = items.filter((item) => {
          const key = distinct.map((d) => item[d]).join(":");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      if (orderBy) {
        items = sortItems(items, orderBy);
      }

      if (take && typeof take === "number") {
        items = items.slice(0, take);
      }

      items = items.map((item) => attachRelations(modelName, item, include));

      if (select && typeof select === "object") {
        items = items.map((item) => {
          const projected: any = {};
          for (const key of Object.keys(select)) {
            if (select[key]) projected[key] = item[key];
          }
          return projected;
        });
      }

      return items;
    },

    async findFirst(args: any = {}) {
      const results = await this.findMany(args);
      return results[0] || null;
    },

    async findUnique(args: any = {}) {
      return this.findFirst(args);
    },

    async create(args: any = {}) {
      const { data } = args;
      const newItem = {
        id: data?.id || randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
      };
      store[modelName].unshift(newItem);
      return newItem;
    },

    async update(args: any = {}) {
      const { where, data } = args;
      const index = store[modelName].findIndex((item) => matchesFilter(item, where));
      if (index === -1) {
        throw new Error(`Record to update not found in ${modelName}`);
      }
      const updated = {
        ...store[modelName][index],
        ...data,
        updated_at: new Date(),
      };
      store[modelName][index] = updated;
      return updated;
    },

    async delete(args: any = {}) {
      const { where } = args;
      const index = store[modelName].findIndex((item) => matchesFilter(item, where));
      if (index === -1) return null;
      const [deleted] = store[modelName].splice(index, 1);
      return deleted;
    },

    async count(args: any = {}) {
      const { where } = args;
      return (store[modelName] || []).filter((item) => matchesFilter(item, where)).length;
    },

    async groupBy(args: any = {}) {
      const { by, where, _count } = args;
      const items = (store[modelName] || []).filter((item) => matchesFilter(item, where));
      const groupField = by?.[0];
      const counts: Record<string, number> = {};

      for (const item of items) {
        const val = item[groupField] ?? "UNKNOWN";
        counts[val] = (counts[val] || 0) + 1;
      }

      return Object.entries(counts).map(([status, count]) => ({
        [groupField]: status,
        _count: { id: count },
      }));
    },

    async aggregate(args: any = {}) {
      const { where, _sum } = args;
      const items = (store[modelName] || []).filter((item) => matchesFilter(item, where));
      const sumResult: Record<string, number> = {};

      if (_sum) {
        for (const field of Object.keys(_sum)) {
          sumResult[field] = items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
        }
      }

      return { _sum: sumResult };
    },
  };
}

const mockPrisma: any = {
  organizations: createModelHandler("organizations"),
  users: createModelHandler("users"),
  customers: createModelHandler("customers"),
  invoices: createModelHandler("invoices"),
  payments: createModelHandler("payments"),
  conversations: createModelHandler("conversations"),
  messages: createModelHandler("messages"),
  collection_actions: createModelHandler("collection_actions"),
  async $transaction(fn: any) {
    if (typeof fn === "function") {
      return fn(mockPrisma);
    }
    return Promise.all(fn);
  },
  async $queryRaw() {
    return [{ "?column?": 1 }];
  },
};

// Fallback proxy to ensure any unexpected query or property never throws
const prisma = new Proxy(mockPrisma, {
  get(target, prop: string | symbol) {
    if (prop === "default" || prop === "__esModule") return target;
    if (typeof prop === "string" && prop in target) return (target as any)[prop];
    if (typeof prop === "symbol") return (target as any)[prop];
    return createModelHandler(prop as any);
  },
});

export default prisma;
