import Stripe from "stripe";
import { hasEnv, requireEnv } from "@/lib/env";

/**
 * Stripe adapter. Payment card data never touches our servers — Stripe hosts
 * checkout and we mirror state via webhooks (see app/api/webhooks/stripe).
 *
 * The client is created lazily so the app boots without Stripe configured.
 */

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return hasEnv("STRIPE_SECRET_KEY");
}

export function stripe(): Stripe {
  if (cached) return cached;
  const { STRIPE_SECRET_KEY } = requireEnv("STRIPE_SECRET_KEY");
  // Pin to the SDK's default API version by omitting `apiVersion` — Stripe
  // then uses the version bundled with this library, avoiding drift.
  cached = new Stripe(STRIPE_SECRET_KEY, {
    appInfo: { name: "gym-plzen" },
  });
  return cached;
}

/** Verify and construct a Stripe webhook event from the raw request body. */
export function constructStripeEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const { STRIPE_WEBHOOK_SECRET } = requireEnv("STRIPE_WEBHOOK_SECRET");
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET,
  );
}

/** Get or create a Stripe customer for a member and return its id. */
export async function ensureStripeCustomer(params: {
  existingCustomerId: string | null;
  email: string;
  name?: string | null;
  userId: string;
}): Promise<string> {
  if (params.existingCustomerId) return params.existingCustomerId;
  const customer = await stripe().customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: { userId: params.userId },
  });
  return customer.id;
}

/** Create a Checkout session for a subscription to a plan's Stripe price. */
export async function createSubscriptionCheckout(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    // Enable Apple Pay / Google Pay automatically alongside cards.
    payment_method_types: ["card"],
  });
}

/** Create a Checkout session for a one-off single-session payment. */
export async function createOneOffCheckout(params: {
  customerId?: string;
  amountCents: number;
  currency?: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.create({
    mode: "payment",
    customer: params.customerId,
    line_items: [
      {
        price_data: {
          currency: params.currency ?? "czk",
          product_data: { name: params.description },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
}

export { Stripe };
