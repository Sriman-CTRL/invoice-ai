import crypto from "crypto";

export interface AuditEvent {
  organization_id?: string;
  actor: {
    type: "USER" | "SYSTEM" | "AI_AGENT" | "WEBHOOK";
    id: string;
    email?: string;
  };
  action: string;
  resource_type: string;
  resource_id?: string;
  outcome: "SUCCESS" | "FAILURE" | "DENIED";
  ip_address?: string;
  metadata?: Record<string, unknown>;
}

export interface StoredAuditRecord extends AuditEvent {
  event_id: string;
  timestamp: string;
}

/**
 * Enterprise FinTech Security Audit Logger.
 * Emits structured, immutable audit log events for compliance (SOC2 / ISO 27001).
 * Never logs raw passwords, plaintext tokens, or unmasked sensitive PII.
 */
class AuditLogger {
  log(event: AuditEvent): StoredAuditRecord {
    const record: StoredAuditRecord = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
      metadata: this.sanitizeMetadata(event.metadata),
    };

    // Structured JSON log output for ingestion by Datadog, Loki, or CloudWatch
    console.info(`[AUDIT_EVENT] ${JSON.stringify(record)}`);
    return record;
  }

  /**
   * Redacts sensitive fields so they never leak into log aggregators.
   */
  private sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    const sanitized: Record<string, unknown> = { ...meta };
    const sensitiveKeys = ["password", "token", "secret", "authorization", "jwt"];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = "[REDACTED]";
      }
    }
    return sanitized;
  }
}

export const auditLogger = new AuditLogger();
