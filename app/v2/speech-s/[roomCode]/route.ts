import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;

  const url = new URL(request.url);
  const org = url.searchParams.get('org');
  const pin = url.searchParams.get('pin');
  const postCallRedirect = url.searchParams.get('postCallRedirect');

  let redirectUrl = `/v2/rooms/${roomCode}?speech=true&role=student`;
  if (org) redirectUrl += `&org=${encodeURIComponent(org)}`;
  if (pin) redirectUrl += `&pin=${encodeURIComponent(pin)}`;
  if (postCallRedirect) {
    redirectUrl += `&postCallRedirect=${encodeURIComponent(postCallRedirect)}`;
  }

  redirect(redirectUrl);
}
