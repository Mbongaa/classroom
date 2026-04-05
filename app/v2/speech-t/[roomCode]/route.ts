import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;

  const url = new URL(request.url);
  const org = url.searchParams.get('org');

  let redirectUrl = `/v2/rooms/${roomCode}?speech=true&role=teacher`;
  if (org) redirectUrl += `&org=${encodeURIComponent(org)}`;

  redirect(redirectUrl);
}
