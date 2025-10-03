import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSessionId } from '@/lib/recording-utils';

/**
 * POST /api/sessions/init
 * Initialize a transcription session for a room
 * Called when any participant joins - creates session record for saving translations
 * Works independently of video recording
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, roomSid, participantName } = body;

    if (!roomName || !roomSid || !participantName) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, roomSid, participantName' },
        { status: 400 },
      );
    }

    // Generate session ID (e.g., "MATH101_2025-01-31_14-30")
    const sessionId = generateSessionId(roomName);

    const supabase = createAdminClient();

    // Check if session already exists (multiple participants may call this)
    const { data: existing } = await supabase
      .from('session_recordings')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existing) {
      console.log(`[Session Init] Session already exists: ${sessionId}`);
      return NextResponse.json({
        success: true,
        session: existing,
        existed: true,
      });
    }

    // Create new session record (transcript-only initially)
    const { data, error } = await supabase
      .from('session_recordings')
      .insert({
        room_sid: roomSid,
        room_name: roomName,
        session_id: sessionId,
        livekit_egress_id: `transcript-${sessionId}`, // Unique placeholder for each session
        teacher_name: participantName,
        status: 'ACTIVE', // Session active for transcriptions
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Session Init] Failed to create session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    console.log(`[Session Init] Created new session: ${sessionId} (ID: ${data.id})`);

    return NextResponse.json({
      success: true,
      session: data,
      existed: false,
    });
  } catch (error) {
    console.error('[Session Init] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
