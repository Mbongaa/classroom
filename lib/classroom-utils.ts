import { createAdminClient } from './supabase/admin';

/**
 * Classroom database utilities for LiveKit classroom management
 *
 * This module provides Supabase-first classroom management where:
 * - Supabase is the single source of truth for classroom data
 * - LiveKit rooms are created lazily on-demand when users join
 * - classroom.id (UUID) is used as the LiveKit room name for uniqueness
 * - room_code is the user-facing identifier in URLs
 */

export interface Classroom {
  id: string;
  organization_id: string;
  room_code: string;
  teacher_id: string;
  name: string;
  description: string | null;
  settings: {
    language: string;
    enable_recording: boolean;
    enable_chat: boolean;
    max_participants: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClassroomParams {
  organizationId: string;
  roomCode: string;
  teacherId: string;
  name: string;
  description?: string;
  settings: {
    language: string;
    enable_recording: boolean;
    enable_chat: boolean;
    max_participants: number;
  };
}

/**
 * Create a new classroom record in Supabase
 *
 * @param params - Classroom creation parameters
 * @returns Created classroom record
 * @throws Error if creation fails or room_code already exists in organization
 */
export async function createClassroom(params: CreateClassroomParams): Promise<Classroom> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('classrooms')
    .insert({
      organization_id: params.organizationId,
      room_code: params.roomCode,
      teacher_id: params.teacherId,
      name: params.name,
      description: params.description || null,
      settings: params.settings,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error(
        `Room code "${params.roomCode}" already exists in your organization. Please choose a different code.`
      );
    }
    throw new Error(`Failed to create classroom: ${error.message}`);
  }

  return data as Classroom;
}

/**
 * Get classroom by room code
 *
 * @param roomCode - User-facing room code (e.g., "MATH101")
 * @param organizationId - Optional organization ID for filtering (multi-tenant)
 * @returns Classroom record or null if not found
 */
export async function getClassroomByRoomCode(
  roomCode: string,
  organizationId?: string
): Promise<Classroom | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from('classrooms')
    .select('*')
    .eq('room_code', roomCode)
    .eq('is_active', true);

  // Apply organization filter if provided (multi-tenant isolation)
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.single();

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get classroom: ${error.message}`);
  }

  return data as Classroom;
}

/**
 * Get classroom by ID (UUID)
 *
 * @param classroomId - Classroom UUID (also used as LiveKit room name)
 * @returns Classroom record or null if not found
 */
export async function getClassroomById(classroomId: string): Promise<Classroom | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('id', classroomId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get classroom: ${error.message}`);
  }

  return data as Classroom;
}

/**
 * List all active classrooms for an organization
 *
 * @param organizationId - Organization UUID
 * @returns Array of classroom records
 */
export async function listClassrooms(organizationId: string): Promise<Classroom[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('classrooms')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list classrooms: ${error.message}`);

  return (data || []) as Classroom[];
}

/**
 * Soft delete a classroom (set is_active = false)
 *
 * @param roomCode - Room code to delete
 * @param teacherId - Teacher ID for authorization
 * @param organizationId - Organization ID for multi-tenant isolation
 * @throws Error if classroom not found or user not authorized
 */
export async function deleteClassroom(
  roomCode: string,
  teacherId: string,
  organizationId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Soft delete - set is_active to false
  const { error } = await supabase
    .from('classrooms')
    .update({ is_active: false })
    .eq('room_code', roomCode)
    .eq('teacher_id', teacherId)
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to delete classroom: ${error.message}`);
  }
}

/**
 * Update classroom settings
 *
 * @param classroomId - Classroom UUID
 * @param updates - Partial classroom updates
 */
export async function updateClassroom(
  classroomId: string,
  updates: {
    name?: string;
    description?: string;
    settings?: Partial<Classroom['settings']>;
  }
): Promise<Classroom> {
  const supabase = createAdminClient();

  // If updating settings, merge with existing
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.settings) {
    // Fetch current settings to merge
    const { data: current } = await supabase
      .from('classrooms')
      .select('settings')
      .eq('id', classroomId)
      .single();

    if (current) {
      updateData.settings = {
        ...current.settings,
        ...updates.settings,
      };
    }
  }

  const { data, error } = await supabase
    .from('classrooms')
    .update(updateData)
    .eq('id', classroomId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update classroom: ${error.message}`);

  return data as Classroom;
}
