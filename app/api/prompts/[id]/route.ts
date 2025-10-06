import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { getPromptTemplate, updatePromptTemplate, deletePromptTemplate } from '@/lib/prompt-utils';

/**
 * PATCH /api/prompts/[id]
 * Update a prompt template
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'User profile is missing organization' }, { status: 400 });
  }

  try {
    const { id } = await params;
    const templateId = id;

    // Check if template exists and belongs to organization
    const existing = await getPromptTemplate(templateId);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (existing.is_public) {
      return NextResponse.json({ error: 'Public templates cannot be modified' }, { status: 403 });
    }

    if (existing.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: 'You do not have permission to modify this template' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, description, promptText, category } = body;

    // Update prompt template
    const template = await updatePromptTemplate(templateId, {
      name: name?.trim(),
      description: description?.trim(),
      promptText: promptText?.trim(),
      category: category?.trim(),
    });

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error: any) {
    console.error('Error updating prompt template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update prompt template' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/prompts/[id]
 * Delete a prompt template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Require teacher authentication
  const auth = await requireTeacher();
  if (!auth.success) return auth.response;

  const { profile } = auth;

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'User profile is missing organization' }, { status: 400 });
  }

  try {
    const { id } = await params;
    const templateId = id;

    // Delete prompt template (function handles authorization checks)
    await deletePromptTemplate(templateId, profile.organization_id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting prompt template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete prompt template' },
      { status: 500 },
    );
  }
}
