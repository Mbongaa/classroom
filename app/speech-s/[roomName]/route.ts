import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // Forward org and pin query params for organization-scoped room lookup
  const url = new URL(request.url);
  const org = url.searchParams.get('org');
  const pin = url.searchParams.get('pin');

  let redirectUrl = `/rooms/${roomName}?speech=true&role=student`;
  if (org) redirectUrl += `&org=${encodeURIComponent(org)}`;
  if (pin) redirectUrl += `&pin=${encodeURIComponent(pin)}`;

  redirect(redirectUrl);
}
