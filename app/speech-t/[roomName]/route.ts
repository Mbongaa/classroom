import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // Redirect to the main room page with speech teacher role
  // The /speech-t/ prefix indicates this is a speech teacher join link
  redirect(`/rooms/${roomName}?speech=true&role=teacher`);
}
