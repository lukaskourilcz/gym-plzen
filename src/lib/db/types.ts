import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type * as s from "./schema";

/**
 * Row and insert types derived directly from the schema, so application code
 * never redeclares the shape of a table. `Select*` = a row read back;
 * `New*` = the object accepted by `.insert()`.
 */

export type Profile = InferSelectModel<typeof s.profiles>;

export type Reservation = InferSelectModel<typeof s.reservation>;
export type NewReservation = InferInsertModel<typeof s.reservation>;
export type BlockedSlot = InferSelectModel<typeof s.blockedSlot>;
export type OpeningHours = InferSelectModel<typeof s.openingHours>;

export type Payment = InferSelectModel<typeof s.payment>;

export type AccessCode = InferSelectModel<typeof s.accessCode>;
export type EntryLog = InferSelectModel<typeof s.entryLog>;

export type MessageDelivery = InferSelectModel<typeof s.messageDelivery>;

export type ContentBlock = InferSelectModel<typeof s.contentBlock>;
export type MediaAsset = InferSelectModel<typeof s.mediaAsset>;

export type ReservationPipeline = InferSelectModel<
  typeof s.reservationPipeline
>;
export type SystemAlert = InferSelectModel<typeof s.systemAlert>;

export type Voucher = InferSelectModel<typeof s.voucher>;
export type NewsletterSubscriber = InferSelectModel<
  typeof s.newsletterSubscriber
>;
