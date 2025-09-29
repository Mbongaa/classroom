import { redirect } from 'next/navigation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const { roomName } = await params;

  // Redirect to the main room page with speech student role
  // The /speech-s/ prefix indicates this is a speech student join link
  redirect(`/rooms/${roomName}?speech=true&role=student`);
}