'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { PromptTemplateList } from '@/app/components/PromptTemplateList';
import { PromptTemplateEditor } from '@/app/components/PromptTemplateEditor';
import type { PromptTemplate } from '@/lib/prompt-utils';

export default function PromptsPage() {
  const t = useTranslations('prompts');
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
        throw new Error(data.error || t('errors.fetchFailed'));
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message || t('errors.loadFailed'));
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
        throw new Error(data.error || t('errors.deleteFailed'));
      }

      // Refresh the list
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || t('errors.deleteFailed'));
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
        <h1 className="text-3xl font-bold mb-2 text-black dark:text-white">{t('title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('subtitleStart')}
          <code>{'{source_lang}'}</code>
          {t('subtitleMiddle')}
          <code>{'{target_lang}'}</code>
          {t('subtitleEnd')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2 text-black dark:text-white" />
            {t('createNew')}
          </Button>
        </div>
        <Button variant="outline" onClick={fetchTemplates} disabled={loading} title={t('refresh')}>
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
          <p className="mt-2 text-muted-foreground">{t('loading')}</p>
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
        <h3 className="font-semibold mb-2 text-black dark:text-white">{t('info.title')}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            • <strong className="text-black dark:text-white">{t('info.createBold')}</strong>
            {t('info.createRest', { source: '{source_lang}', target: '{target_lang}' })}
          </li>
          <li>
            • <strong className="text-black dark:text-white">{t('info.selectBold')}</strong>
            {t('info.selectRest')}
          </li>
          <li>
            • <strong className="text-black dark:text-white">{t('info.placeholderBold')}</strong>
            {t('info.placeholderRest')}
          </li>
          <li>
            • <strong className="text-black dark:text-white">{t('info.oneBold')}</strong>
            {t('info.oneRest')}
          </li>
          <li>
            • <strong className="text-black dark:text-white">{t('info.publicBold')}</strong>
            {t('info.publicRest')}
          </li>
        </ul>
      </div>
    </div>
  );
}
