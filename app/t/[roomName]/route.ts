import { redirect } from 'next/navigation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const { roomName } = await params;

  // Parse the URL to get any query parameters (like PIN)
  const url = new URL(request.url);
  const pin = url.searchParams.get('pin');

  // Redirect to the main room page with teacher role
  // The /t/ prefix indicates this is a teacher join link
  let redirectUrl = `/rooms/${roomName}?classroom=true&role=teacher`;
  if (pin) {
    redirectUrl += `&pin=${pin}`;
  }

  redirect(redirectUrl);
}