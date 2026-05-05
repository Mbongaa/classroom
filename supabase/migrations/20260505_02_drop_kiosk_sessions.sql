-- =====================================================
-- Drop kiosk_sessions table
--
-- The kiosk flow no longer creates per-scan sessions. The kiosk display
-- is passive and shows a single static QR pointing at /donate/[mosque].
-- Realtime tablet-reset based on the scanned row is no longer needed.
-- =====================================================

DROP TABLE IF EXISTS public.kiosk_sessions;
