import { redirect } from 'next/navigation';

/**
 * Legacy teacher classroom entry — kept as a thin redirect shim to /v2/t.
 *
 * All connect logic now lives in the v2 stack (/api/v2/connect → v2_sessions).
 * This route exists only so previously-shared links keep working; it forwards
 * the path + query string to /v2/t/[roomCode], which owns the room_type
 * detection and the redirect to /v2/rooms/[roomCode].
 */
export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;
  const search = new URL(request.url).search; // includes leading "?" or empty
  redirect(`/v2/t/${roomName}${search}`);
}
