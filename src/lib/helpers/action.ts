import { z } from "zod";
import { err, ok, type Result } from "./result";
import { logger } from "./logger";

/**
 * Factory for type-safe Server Actions. It:
 *   1. validates the input with a Zod schema (returning fieldErrors on failure),
 *   2. optionally runs an authorization check,
 *   3. runs the handler and normalises thrown errors into a `Result`.
 *
 * This keeps every action's boilerplate (parse → authorize → try/catch) in one
 * place so individual actions are just their business logic.
 *
 * @example
 *   export const createPlan = defineAction({
 *     schema: createPlanSchema,
 *     authorize: assertAdmin,
 *     handler: async (input, admin) => { ...; return plan; },
 *   });
 */
export function defineAction<
  S extends z.ZodTypeAny,
  TOutput,
  TCtx = void,
>(config: {
  schema: S;
  authorize?: () => Promise<TCtx>;
  handler: (input: z.infer<S>, ctx: TCtx) => Promise<TOutput>;
}) {
  return async (rawInput: unknown): Promise<Result<TOutput>> => {
    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return err(
        "Zkontrolujte prosím vyplněná pole.",
        flat.fieldErrors as Record<string, string[]>,
      );
    }

    let ctx: TCtx;
    try {
      ctx = config.authorize ? await config.authorize() : (undefined as TCtx);
    } catch (e) {
      logger.warn("Action authorization failed", { error: String(e) });
      return err("Nemáte oprávnění k této akci.");
    }

    try {
      const data = await config.handler(parsed.data, ctx);
      return ok(data);
    } catch (e) {
      if (e instanceof ActionError) {
        // An outcome the visitor is told about in so many words (a taken
        // slot, an invalid voucher, a rate limit) is context for the next
        // real failure, not a failure of its own: a warning breadcrumb, not a
        // Sentry issue for every rejected form.
        logger.warn(`Action rejected: ${e.message}`, {
          where: "defineAction.handler",
        });
        return err(e.message);
      }
      logger.error(e, { where: "defineAction.handler" });
      return err("Došlo k neočekávané chybě. Zkuste to prosím znovu.");
    }
  };
}

/**
 * Throw this inside an action/service handler to return a controlled,
 * user-facing error message (instead of the generic fallback).
 */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}
