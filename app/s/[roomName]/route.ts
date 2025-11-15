import { redirect } from 'next/navigation';

export async function GET(request: Request, { params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;

  // Redirect to the main room page with student role
  // The /s/ prefix indicates this is a student join link for classroom
  redirect(`/rooms/${roomName}?classroom=true&role=student`);
}
