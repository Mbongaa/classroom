import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // Forward org query param for organization-scoped room lookup
  const url = new URL(request.url);
  const org = url.searchParams.get('org');

  let redirectUrl = `/rooms/${roomName}?speech=true&role=teacher`;
  if (org) redirectUrl += `&org=${encodeURIComponent(org)}`;

  redirect(redirectUrl);
}
