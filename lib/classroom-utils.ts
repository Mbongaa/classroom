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
  room_type: 'meeting' | 'classroom' | 'speech'; // Type of room
  settings: {
    language: string;
    enable_recording: boolean;
    enable_chat: boolean;
    max_participants: number;
  };
  translation_prompt_id: string | null;
  transcription_language: string;
  context_window_size: number;
  max_delay: number;
  punctuation_sensitivity: number;
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
  roomType?: 'meeting' | 'classroom' | 'speech'; // Default: 'classroom'
  settings: {
    language: string;
    enable_recording: boolean;
    enable_chat: boolean;
    max_participants: number;
  };
  translationPromptId?: string | null;
  contextWindowSize?: number;
  maxDelay?: number;
  punctuationSensitivity?: number;
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
      room_type: params.roomType || 'classroom', // Default to 'classroom' for backward compatibility
      settings: params.settings,
      translation_prompt_id: params.translationPromptId || null,
      context_window_size: params.contextWindowSize ?? 12,
      max_delay: params.maxDelay ?? 3.5,
      punctuation_sensitivity: params.punctuationSensitivity ?? 0.5,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error(
        `Room code "${params.roomCode}" already exists in your organization. Please choose a different code.`,
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
  organizationId?: string,
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
  organizationId: string,
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
  },
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

export interface UpdateClassroomFullParams {
  name?: string;
  description?: string | null;
  roomType?: 'meeting' | 'classroom' | 'speech';
  settings?: Partial<Classroom['settings']>;
  translationPromptId?: string | null;
  contextWindowSize?: number;
  maxDelay?: number;
  punctuationSensitivity?: number;
}

/**
 * Update all editable classroom fields
 *
 * @param roomCode - Room code (user-facing identifier)
 * @param teacherId - Teacher ID for authorization
 * @param organizationId - Organization ID for multi-tenant isolation
 * @param updates - Full classroom updates
 * @throws Error if classroom not found or user not authorized
 */
export async function updateClassroomFull(
  roomCode: string,
  teacherId: string,
  organizationId: string,
  updates: UpdateClassroomFullParams,
): Promise<Classroom> {
  const supabase = createAdminClient();

  // Build update data object
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  // Map updates to database columns
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.roomType !== undefined) updateData.room_type = updates.roomType;
  if (updates.translationPromptId !== undefined) updateData.translation_prompt_id = updates.translationPromptId;
  if (updates.contextWindowSize !== undefined) updateData.context_window_size = updates.contextWindowSize;
  if (updates.maxDelay !== undefined) updateData.max_delay = updates.maxDelay;
  if (updates.punctuationSensitivity !== undefined) updateData.punctuation_sensitivity = updates.punctuationSensitivity;

  // Handle settings merge
  if (updates.settings) {
    // Fetch current settings to merge
    const { data: current } = await supabase
      .from('classrooms')
      .select('settings')
      .eq('room_code', roomCode)
      .eq('teacher_id', teacherId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .single();

    if (current) {
      updateData.settings = {
        ...current.settings,
        ...updates.settings,
      };
    } else {
      throw new Error('Classroom not found or you do not have permission to update it');
    }
  }

  // Perform update
  const { data, error } = await supabase
    .from('classrooms')
    .update(updateData)
    .eq('room_code', roomCode)
    .eq('teacher_id', teacherId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Classroom not found or you do not have permission to update it');
    }
    throw new Error(`Failed to update classroom: ${error.message}`);
  }

  return data as Classroom;
}
