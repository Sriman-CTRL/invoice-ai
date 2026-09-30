import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
}
const SECRET = JWT_SECRET || "fallback_secret_for_development";

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
        const decoded = jwt.verify(token, SECRET) as AuthUser;
        req.user = decoded;

        // Backward compatibility: If organization_id is in query/body, verify it matches
        const reqOrgId = req.query.organization_id || req.body?.organization_id;
        if (reqOrgId && reqOrgId !== decoded.organization_id) {
            res.status(403).json({ error: "Access denied. Cross-tenant request rejected." });
            return;
        }

        // Express 5 exposes req.query as a computed, read-only object. Preserve
        // the existing route contract by adding the verified tenant to the URL
        // instead of mutating req.query (which would make valid JWTs fail).
        if (!req.query.organization_id) {
            const [path, queryString = ""] = req.url.split("?");
            const query = new URLSearchParams(queryString);
            query.set("organization_id", decoded.organization_id);
            req.url = `${path}?${query.toString()}`;
        }
        if (req.method !== "GET" && typeof req.body === "object" && !req.body.organization_id) {
            req.body.organization_id = decoded.organization_id;
        }

        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid token" });
        return;
    }
}
