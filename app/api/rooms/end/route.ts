import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { deleteRoom } from '@/lib/v2/livekit-helpers';

const ROOM_NAME_RE = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  try {
    const body = (await request.json()) as {
      roomName?: string;
      language?: string;
    };

    const roomName = body.roomName?.trim();
    if (!roomName || !ROOM_NAME_RE.test(roomName)) {
      return NextResponse.json({ error: 'Invalid roomName' }, { status: 400 });
    }

    const language = body.language === 'ar' ? 'ar' : body.language || 'en';
    await deleteRoom(roomName, language);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to end room';
    console.error('[Rooms End] Failed to delete LiveKit room:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
