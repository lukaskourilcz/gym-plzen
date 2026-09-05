import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type * as s from "./schema";

/**
 * Row and insert types derived directly from the schema, so application code
 * never redeclares the shape of a table. `Select*` = a row read back;
 * `New*` = the object accepted by `.insert()`.
 */

export type Profile = InferSelectModel<typeof s.profiles>;
export type NewProfile = InferInsertModel<typeof s.profiles>;

export type Reservation = InferSelectModel<typeof s.reservation>;
export type NewReservation = InferInsertModel<typeof s.reservation>;
export type BlockedSlot = InferSelectModel<typeof s.blockedSlot>;
export type NewBlockedSlot = InferInsertModel<typeof s.blockedSlot>;
export type OpeningHours = InferSelectModel<typeof s.openingHours>;

export type MembershipPlan = InferSelectModel<typeof s.membershipPlan>;
export type NewMembershipPlan = InferInsertModel<typeof s.membershipPlan>;
export type PricingPeriod = InferSelectModel<typeof s.pricingPeriod>;
export type NewPricingPeriod = InferInsertModel<typeof s.pricingPeriod>;
export type Membership = InferSelectModel<typeof s.membership>;
export type Payment = InferSelectModel<typeof s.payment>;
export type NewPayment = InferInsertModel<typeof s.payment>;

export type AccessCode = InferSelectModel<typeof s.accessCode>;
export type NewAccessCode = InferInsertModel<typeof s.accessCode>;
export type EntryLog = InferSelectModel<typeof s.entryLog>;

export type MessageDelivery = InferSelectModel<typeof s.messageDelivery>;
export type NewMessageDelivery = InferInsertModel<typeof s.messageDelivery>;
export type MarketingCampaign = InferSelectModel<typeof s.marketingCampaign>;

export type ContentBlock = InferSelectModel<typeof s.contentBlock>;
export type NewContentBlock = InferInsertModel<typeof s.contentBlock>;
export type MediaAsset = InferSelectModel<typeof s.mediaAsset>;
export type Page = InferSelectModel<typeof s.page>;
export type SiteSetting = InferSelectModel<typeof s.siteSetting>;

export type Invoice = InferSelectModel<typeof s.invoice>;
export type NewInvoice = InferInsertModel<typeof s.invoice>;

export type ReservationPipeline = InferSelectModel<
  typeof s.reservationPipeline
>;
export type SystemAlert = InferSelectModel<typeof s.systemAlert>;
export type WebhookEvent = InferSelectModel<typeof s.webhookEvent>;

export type Voucher = InferSelectModel<typeof s.voucher>;
export type NewVoucher = InferInsertModel<typeof s.voucher>;
export type VoucherRedemption = InferSelectModel<typeof s.voucherRedemption>;
export type NewsletterSubscriber = InferSelectModel<
  typeof s.newsletterSubscriber
>;
