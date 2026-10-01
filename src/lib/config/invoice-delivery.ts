export const INVOICE_OPERATOR_EMAIL = "info@navigym.cz";
export const INVOICE_DESTINATIONS = ["operator", "customer", "both"] as const;
export type InvoiceDestination = (typeof INVOICE_DESTINATIONS)[number];

export interface ReservationInvoiceState {
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerEmail: string | null;
  eligible: boolean;
}
