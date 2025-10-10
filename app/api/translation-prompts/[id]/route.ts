import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

/**
 * GET /api/translation-prompts/[id]
 * Fetch a translation prompt template by ID
 * Public templates are accessible to all, org templates require membership
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Prompt ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch the translation prompt template
    const { data: prompt, error } = await supabase
      .from('translation_prompt_templates')
      .select('id, name, description, prompt_text, category, is_public')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching translation prompt:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Translation prompt not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch translation prompt' },
        { status: 500 },
      );
    }

    // Check access: public templates are open, org templates need membership check
    if (!prompt.is_public) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Check if user belongs to the organization that owns this template
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'You do not have access to this template' },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      prompt_text: prompt.prompt_text,
      category: prompt.category,
      is_public: prompt.is_public,
    });
  } catch (error: any) {
    console.error('Error in translation prompt endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 },
    );
  }
}