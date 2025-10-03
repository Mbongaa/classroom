import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSessionId } from '@/lib/recording-utils';

/**
 * POST /api/sessions/create
 * Create or get a session for transcription/translation tracking
 * Called when participants join a room
 * Independent of video recording
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, roomSid } = body;

    if (!roomName || !roomSid) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, roomSid' },
        { status: 400 },
      );
    }

    // Generate session ID (e.g., "MATH101_2025-01-31_14-30")
    const sessionId = generateSessionId(roomName);

    const supabase = createAdminClient();

    // Check if session already exists
    const { data: existing, error: checkError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[Session Create] Error checking existing session:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log(`[Session Create] Session already exists: ${sessionId}`);
      return NextResponse.json({
        success: true,
        session: existing,
        existed: true,
      });
    }

    // Create new session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        room_sid: roomSid,
        room_name: roomName,
        session_id: sessionId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[Session Create] Failed to create session:', error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    console.log(`[Session Create] Created new session: ${sessionId} (ID: ${data.id})`);

    return NextResponse.json({
      success: true,
      session: data,
      existed: false,
    });
  } catch (error) {
    console.error('[Session Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}