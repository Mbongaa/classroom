'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { PromptTemplateList } from '@/app/components/PromptTemplateList';
import { PromptTemplateEditor } from '@/app/components/PromptTemplateEditor';
import type { PromptTemplate } from '@/lib/prompt-utils';

export default function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [error, setError] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/prompts');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompt templates');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    try {
      const response = await fetch(`/api/prompts/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete template');
      }

      // Refresh the list
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
      console.error('Error deleting template:', err);
    }
  };

  const handleSaveComplete = () => {
    // Refresh the list after save
    fetchTemplates();
  };

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-black dark:text-white">
          Translation Prompt Templates
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Create and manage reusable translation prompts for your classrooms. Use {'{source_lang}'}{' '}
          and {'{target_lang}'} placeholders to create language-agnostic templates.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2 text-black dark:text-white" />
            Create New Template
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={fetchTemplates}
          disabled={loading}
          title="Refresh templates"
        >
          <RefreshCw
            className={`h-4 w-4 text-black dark:text-white ${loading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Loading templates...</p>
        </div>
      )}

      {/* Templates List */}
      {!loading && (
        <PromptTemplateList templates={templates} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {/* Editor Modal */}
      <PromptTemplateEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editingTemplate}
        onSave={handleSaveComplete}
      />

      {/* Info Box */}
      <div className="mt-8 p-6 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2 text-black dark:text-white">
          How to Use Prompt Templates
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • <strong className="text-black dark:text-white">Create templates</strong> with{' '}
            {'{source_lang}'} and {'{target_lang}'} placeholders
          </li>
          <li>
            • <strong className="text-black dark:text-white">Select a template</strong> when
            creating a classroom
          </li>
          <li>
            •{' '}
            <strong className="text-black dark:text-white">
              Placeholders are automatically replaced
            </strong>{' '}
            with actual language names during translation
          </li>
          <li>
            •{' '}
            <strong className="text-black dark:text-white">
              One template works for all languages
            </strong>{' '}
            - students can request any language and use the same custom prompt
          </li>
          <li>
            • <strong className="text-black dark:text-white">Public templates</strong> are provided
            by default and cannot be modified
          </li>
        </ul>
      </div>
    </div>
  );
}
