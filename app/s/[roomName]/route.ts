import { redirect } from 'next/navigation';

/**
 * Legacy student classroom entry — kept as a thin redirect shim to /v2/s.
 *
 * All connect logic now lives in the v2 stack (/api/v2/connect → v2_sessions).
 * This route exists only so previously-shared links keep working; it forwards
 * the path + query string (including org and pin) to /v2/s/[roomCode].
 */
export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;
  const search = new URL(request.url).search;
  redirect(`/v2/s/${roomName}${search}`);
}
