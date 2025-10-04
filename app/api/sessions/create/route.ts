import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/sessions/create
 * Create or get a session for transcription/translation tracking
 * Called when participants join a room
 * Independent of video recording
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, roomSid, sessionId } = body;

    if (!roomName || !roomSid || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: roomName, roomSid, sessionId' },
        { status: 400 },
      );
    }

    // Use client-provided session ID (generated on client to ensure consistency)
    // Format: "MATH101_2025-01-31_14-30"

    const supabase = createAdminClient();

    // CRITICAL: Check if session already exists for this LiveKit room instance
    // The room_sid is the unique identifier for this specific room instance
    const { data: existing, error: checkError } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_sid', roomSid) // Check by LiveKit room SID, not session_id
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[Session Create] Error checking existing session:', checkError);
      throw checkError;
    }

    if (existing) {
      console.log(`[Session Create] Session already exists for room_sid: ${roomSid}, session_id: ${existing.session_id}`);
      // Important: Update the sessionId in the response to match what's in the database
      // This ensures all participants use the same session_id
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