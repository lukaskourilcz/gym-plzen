-- Empty new feature tables at deployment; no customer-row or configuration writes.
CREATE INDEX reservation_change_user_completed_idx ON reservation_change(user_id, created_at DESC)
 WHERE status = 'completed';
CREATE INDEX reservation_change_recovery_idx ON reservation_change(updated_at)
 WHERE status = 'review_needed' OR (status = 'refund_pending' AND refund_state = 'none');
