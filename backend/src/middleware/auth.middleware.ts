import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../lib/config";
import { auditLogger } from "../lib/auditLogger";

export interface AuthUser {
  id: string;
  organization_id: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as unknown as AuthUser;
    if (!decoded.organization_id) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = decoded;

    // If a tenant id is supplied by the client, it must match the token's.
    const reqOrgId = req.query.organization_id || req.body?.organization_id;
    if (reqOrgId && reqOrgId !== decoded.organization_id) {
      auditLogger.log({
        organization_id: decoded.organization_id,
        actor: { type: "USER", id: decoded.id },
        action: "CROSS_TENANT_ACCESS_BLOCKED",
        resource_type: "ORGANIZATION",
        resource_id: String(reqOrgId),
        outcome: "DENIED",
        ip_address: req.ip,
        metadata: { path: req.originalUrl || req.url, method: req.method },
      });
      res.status(403).json({ error: "Access denied. Cross-tenant request rejected." });
      return;
    }

    // Express 5 exposes req.query as read-only. Add the verified tenant to the
    // URL for GET handlers and to the body for write handlers instead.
    if (!req.query.organization_id) {
      const [path, queryString = ""] = req.url.split("?");
      const query = new URLSearchParams(queryString);
      query.set("organization_id", decoded.organization_id);
      req.url = `${path}?${query.toString()}`;
    }
    if (req.method !== "GET" && typeof req.body === "object" && req.body !== null && !req.body.organization_id) {
      req.body.organization_id = decoded.organization_id;
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
