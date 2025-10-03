import { NextRequest, NextResponse } from 'next/server';
import { getRecording } from '@/lib/recording-utils';

/**
 * GET /api/recordings/[recordingId]
 * Fetch a single recording by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { recordingId: string } },
) {
  try {
    const recording = await getRecording(params.recordingId);

    if (!recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    return NextResponse.json({ recording });
  } catch (error) {
    console.error('[API Recording] Failed to get recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/recordings/[recordingId]
 * Delete a recording (Phase 2 feature - also delete S3 files)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { recordingId: string } },
) {
  try {
    // TODO: Also delete S3 files here (implement in Phase 2)
    // const recording = await getRecording(params.recordingId);
    // Delete HLS segments and MP4 from S3...

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Delete from database (cascade will delete translation_entries)
    const { error } = await supabase
      .from('session_recordings')
      .delete()
      .eq('id', params.recordingId);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      message: 'Recording deleted',
    });
  } catch (error) {
    console.error('[API Recording] Failed to delete recording:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
