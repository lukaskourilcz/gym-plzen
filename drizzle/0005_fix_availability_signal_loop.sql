-- Change availability_signal triggers from FOR EACH STATEMENT to FOR EACH ROW.
-- Statement-level triggers fire even for UPDATE statements affecting zero rows,
-- which caused `releaseExpiredPendingReservations()` (run on every /rezervace
-- request) to phantom-bump availability_signal.version, broadcast a Realtime
-- change, trip RealtimeRefresher.router.refresh() on every connected client,
-- and infinite-loop the page. Row-level triggers fire only when a row actually
-- changes, so 0-row UPDATEs no longer produce phantom broadcasts.

DROP TRIGGER IF EXISTS reservation_availability_signal ON public.reservation;
CREATE TRIGGER reservation_availability_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.reservation
  FOR EACH ROW EXECUTE FUNCTION public.touch_availability_signal();

DROP TRIGGER IF EXISTS blocked_slot_availability_signal ON public.blocked_slot;
CREATE TRIGGER blocked_slot_availability_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.blocked_slot
  FOR EACH ROW EXECUTE FUNCTION public.touch_availability_signal();

DROP TRIGGER IF EXISTS opening_hours_availability_signal ON public.opening_hours;
CREATE TRIGGER opening_hours_availability_signal
  AFTER INSERT OR UPDATE OR DELETE ON public.opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.touch_availability_signal();
