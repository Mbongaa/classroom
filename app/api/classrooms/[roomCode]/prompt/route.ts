import { NextRequest, NextResponse } from 'next/server';
import { getClassroomByRoomCode } from '@/lib/classroom-utils';
import { createClient } from '@/lib/supabase/client';

/**
 * GET /api/classrooms/[roomCode]/prompt
 * Fetch the translation prompt for a specific classroom
 * Returns the full prompt text if a custom prompt is set
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const { roomCode } = await params;

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    // Get the classroom to find its translation_prompt_id
    const classroom = await getClassroomByRoomCode(roomCode);

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    // If no custom prompt is set, return null (agent will use default)
    if (!classroom.translation_prompt_id) {
      return NextResponse.json({
        prompt_text: null,
        message: 'No custom prompt set, using default',
      });
    }

    // Fetch the translation prompt template
    const supabase = await createClient();
    const { data: prompt, error } = await supabase
      .from('translation_prompt_templates')
      .select('prompt_text, name, category')
      .eq('id', classroom.translation_prompt_id)
      .single();

    if (error) {
      console.error('Error fetching translation prompt:', error);
      return NextResponse.json(
        {
          prompt_text: null,
          error: 'Failed to fetch translation prompt',
          message: 'Will use default prompt'
        },
        { status: 200 }, // Return 200 so the app continues with default
      );
    }

    return NextResponse.json({
      prompt_text: prompt.prompt_text,
      prompt_name: prompt.name,
      prompt_category: prompt.category,
      classroom_name: classroom.name,
      classroom_language: classroom.settings?.language,
    });
  } catch (error: any) {
    console.error('Error fetching classroom prompt:', error);
    return NextResponse.json(
      {
        prompt_text: null,
        error: 'Internal server error',
        message: 'Will use default prompt'
      },
      { status: 200 }, // Return 200 so the app continues with default
    );
  }
}