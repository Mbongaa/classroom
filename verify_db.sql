-- Run this in Supabase SQL Editor to verify migrations ran
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'session_recordings'
  AND column_name IN ('room_sid', 'room_name', 'session_id', 'hls_playlist_url', 'mp4_url', 'teacher_name')
ORDER BY column_name;
