/** Optional-channel success must never hide a failed mandatory email. */
export function deliverySummary(
  deliveries: readonly { channel: string; status: string }[],
) {
  return {
    anyDelivered: deliveries.some((delivery) => delivery.status === "sent"),
    emailDelivered: deliveries.some(
      (delivery) => delivery.channel === "email" && delivery.status === "sent",
    ),
  };
}
