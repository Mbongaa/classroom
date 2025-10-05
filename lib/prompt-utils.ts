import { createAdminClient } from './supabase/admin';

/**
 * Translation Prompt Template utilities
 * Handles CRUD operations for reusable translation prompts
 */

export interface PromptTemplate {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  prompt_text: string;
  category: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePromptTemplateParams {
  organizationId: string;
  name: string;
  description?: string;
  promptText: string;
  category?: string;
  createdBy: string;
}

export interface UpdatePromptTemplateParams {
  name?: string;
  description?: string;
  promptText?: string;
  category?: string;
}

/**
 * Validate prompt template text for required placeholders
 * @param promptText - The prompt text to validate
 * @returns Validation result with success flag and error message
 */
export function validatePromptTemplate(promptText: string): {
  valid: boolean;
  error?: string;
} {
  // Check for at least one language placeholder
  const hasSourceLang = promptText.includes('{source_lang}') || promptText.includes('{source_language}');
  const hasTargetLang = promptText.includes('{target_lang}') || promptText.includes('{target_language}');

  if (!hasSourceLang && !hasTargetLang) {
    return {
      valid: false,
      error: 'Prompt must include at least one of: {source_lang}, {source_language}, {target_lang}, or {target_language}',
    };
  }

  // Check minimum length
  if (promptText.length < 20) {
    return {
      valid: false,
      error: 'Prompt text must be at least 20 characters',
    };
  }

  return { valid: true };
}

/**
 * Preview prompt with variable substitution
 * @param promptText - The prompt template text
 * @param sourceLang - Source language name (e.g., "Arabic")
 * @param targetLang - Target language name (e.g., "Spanish")
 * @returns Formatted prompt with variables substituted
 */
export function previewPrompt(
  promptText: string,
  sourceLang: string = 'Arabic',
  targetLang: string = 'Spanish'
): string {
  return promptText
    .replace(/{source_lang}/g, sourceLang)
    .replace(/{source_language}/g, sourceLang)
    .replace(/{target_lang}/g, targetLang)
    .replace(/{target_language}/g, targetLang);
}

/**
 * List all prompt templates available to an organization
 * Includes public templates and organization-specific templates
 *
 * @param organizationId - Organization UUID
 * @returns Array of prompt templates
 */
export async function listPromptTemplates(organizationId: string): Promise<PromptTemplate[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('translation_prompt_templates')
    .select('*')
    .or(`is_public.eq.true,organization_id.eq.${organizationId}`)
    .order('is_public', { ascending: false }) // Public templates first
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list prompt templates: ${error.message}`);

  return (data || []) as PromptTemplate[];
}

/**
 * Get a single prompt template by ID
 *
 * @param templateId - Template UUID
 * @returns Prompt template or null if not found
 */
export async function getPromptTemplate(templateId: string): Promise<PromptTemplate | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('translation_prompt_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get prompt template: ${error.message}`);
  }

  return data as PromptTemplate;
}

/**
 * Create a new prompt template
 *
 * @param params - Template creation parameters
 * @returns Created prompt template
 * @throws Error if creation fails or name already exists in organization
 */
export async function createPromptTemplate(
  params: CreatePromptTemplateParams
): Promise<PromptTemplate> {
  const supabase = createAdminClient();

  // Validate prompt text
  const validation = validatePromptTemplate(params.promptText);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { data, error } = await supabase
    .from('translation_prompt_templates')
    .insert({
      organization_id: params.organizationId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      prompt_text: params.promptText.trim(),
      category: params.category?.trim() || null,
      is_public: false, // Only admins can create public templates
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error(
        `A template named "${params.name}" already exists in your organization. Please choose a different name.`
      );
    }
    throw new Error(`Failed to create prompt template: ${error.message}`);
  }

  return data as PromptTemplate;
}

/**
 * Update an existing prompt template
 *
 * @param templateId - Template UUID
 * @param params - Update parameters
 * @returns Updated prompt template
 */
export async function updatePromptTemplate(
  templateId: string,
  params: UpdatePromptTemplateParams
): Promise<PromptTemplate> {
  const supabase = createAdminClient();

  // Validate prompt text if provided
  if (params.promptText) {
    const validation = validatePromptTemplate(params.promptText);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (params.name !== undefined) updateData.name = params.name.trim();
  if (params.description !== undefined) updateData.description = params.description?.trim() || null;
  if (params.promptText !== undefined) updateData.prompt_text = params.promptText.trim();
  if (params.category !== undefined) updateData.category = params.category?.trim() || null;

  const { data, error } = await supabase
    .from('translation_prompt_templates')
    .update(updateData)
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        `A template named "${params.name}" already exists in your organization. Please choose a different name.`
      );
    }
    throw new Error(`Failed to update prompt template: ${error.message}`);
  }

  return data as PromptTemplate;
}

/**
 * Delete a prompt template
 *
 * @param templateId - Template UUID
 * @param organizationId - Organization ID for authorization check
 * @throws Error if template is public or deletion fails
 */
export async function deletePromptTemplate(
  templateId: string,
  organizationId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Check if template is public (cannot be deleted)
  const { data: template } = await supabase
    .from('translation_prompt_templates')
    .select('is_public')
    .eq('id', templateId)
    .single();

  if (template?.is_public) {
    throw new Error('Public templates cannot be deleted');
  }

  const { error } = await supabase
    .from('translation_prompt_templates')
    .delete()
    .eq('id', templateId)
    .eq('organization_id', organizationId); // Ensure they can only delete their own

  if (error) {
    throw new Error(`Failed to delete prompt template: ${error.message}`);
  }
}
