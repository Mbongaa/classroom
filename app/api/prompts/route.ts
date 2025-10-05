import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import {
  listPromptTemplates,
  createPromptTemplate,
  type PromptTemplate,
} from '@/lib/prompt-utils';

/**
 * GET /api/prompts
 * List all prompt templates available to the organization
 */
export async function GET(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: 'User profile is missing organization' },
      { status: 400 }
    );
  }

  try {
    const templates = await listPromptTemplates(profile.organization_id);

    return NextResponse.json({
      templates,
    });
  } catch (error: any) {
    console.error('Error listing prompt templates:', error);
    return NextResponse.json(
      { error: 'Failed to list prompt templates', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prompts
 * Create a new prompt template
 */
export async function POST(request: NextRequest) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { user, profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json(
      { error: 'User profile is missing organization' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { name, description, promptText, category } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    if (!promptText || typeof promptText !== 'string') {
      return NextResponse.json({ error: 'Prompt text is required' }, { status: 400 });
    }

    // Create prompt template
    const template = await createPromptTemplate({
      organizationId: profile.organization_id,
      name: name.trim(),
      description: description?.trim(),
      promptText: promptText.trim(),
      category: category?.trim(),
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('Error creating prompt template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create prompt template' },
      { status: 500 }
    );
  }
}
