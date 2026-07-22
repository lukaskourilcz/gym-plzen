export function isBookingPreviewEnabled(
  environment: {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
    BOOKING_PREVIEW_FIXTURE?: string;
  } = process.env,
) {
  return (
    environment.BOOKING_PREVIEW_FIXTURE === "true" &&
    environment.NODE_ENV !== "production" &&
    environment.VERCEL_ENV !== "production"
  );
}
