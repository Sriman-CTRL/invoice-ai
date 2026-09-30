import prisma from "../lib/prisma";

export interface ConversationDetails {
    conversation: any;
    customer: any;
    invoice: any | null;
    messages: any[];
    collection_actions: any[];
}

export async function getConversationDetails(organization_id: string, conversation_id: string): Promise<ConversationDetails | null> {
    const conversation = await prisma.conversations.findUnique({
        where: { id: conversation_id },
        include: {
            customers: true,
            invoices: true,
            messages: {
                orderBy: { created_at: "asc" }
            },
            collection_actions: {
                orderBy: { created_at: "desc" }
            }
        }
    });

    if (!conversation || conversation.organization_id !== organization_id) {
        return null;
    }

    const { customers: customer, invoices: invoice, messages, collection_actions, ...convoData } = conversation;

    return {
        conversation: convoData,
        customer,
        invoice,
        messages,
        collection_actions
    };
}
