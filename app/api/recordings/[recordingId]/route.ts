import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getRecording } from '@/lib/recording-utils';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Helper to verify recording belongs to user's organization
 */
async function verifyRecordingAccess(
  recordingId: string,
  organizationId: string,
): Promise<{ allowed: boolean; recording: any | null }> {
  const supabase = createAdminClient();

  // Get the recording with its classroom
  const { data: recording, error } = await supabase
    .from('session_recordings')
    .select('*, classrooms!inner(organization_id)')
    .eq('id', recordingId)
    .single();

  if (error || !recording) {
    return { allowed: false, recording: null };
  }

  // Check if classroom belongs to user's organization
  const classroomOrgId = (recording as any).classrooms?.organization_id;
  if (classroomOrgId !== organizationId) {
    return { allowed: false, recording: null };
  }

  return { allowed: true, recording };
}

/**
 * GET /api/recordings/[recordingId]
 * Fetch a single recording by ID
 *
 * SECURITY: Verifies recording belongs to user's organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  // Require authentication
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user, supabase } = auth;

  try {
    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: 'User profile or organization not found' },
        { status: 400 },
      );
    }

    const { recordingId } = await params;

    // Verify user has access to this recording
    const { allowed, recording } = await verifyRecordingAccess(recordingId, profile.organization_id);

    if (!allowed || !recording) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // Return recording without the joined classrooms data
    const { classrooms, ...recordingData } = recording;
    return NextResponse.json({ recording: recordingData });
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
 *
 * SECURITY: Verifies recording belongs to user's organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  // Require authentication
  const auth = await requireAuth();
  if (!auth.success) return auth.response;

  const { user, supabase } = auth;

  try {
    // Get user's organization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json(
        { error: 'User profile or organization not found' },
        { status: 400 },
      );
    }

    const { recordingId } = await params;

    // Verify user has access to this recording
    const { allowed } = await verifyRecordingAccess(recordingId, profile.organization_id);

    if (!allowed) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }

    // TODO: Also delete S3 files here (implement in Phase 2)
    // Delete HLS segments and MP4 from S3...

    const adminSupabase = createAdminClient();

    // Delete from database (cascade will delete translation_entries)
    const { error } = await adminSupabase.from('session_recordings').delete().eq('id', recordingId);

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
