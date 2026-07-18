import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Catch-all Better Auth endpoint. Handles sign-in/up, OAuth callbacks, session,
 * and the admin plugin routes under /api/auth/*.
 */
export const { GET, POST } = toNextJsHandler(auth);
