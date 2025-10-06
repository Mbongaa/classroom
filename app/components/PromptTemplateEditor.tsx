'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { previewPrompt, validatePromptTemplate } from '@/lib/prompt-utils';
import type { PromptTemplate } from '@/lib/prompt-utils';

interface PromptTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: PromptTemplate | null;
  onSave: () => void;
}

const CATEGORIES = [
  { value: 'formal', label: 'Formal Academic' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'technical', label: 'Technical' },
  { value: 'religious', label: 'Religious/Spiritual' },
  { value: 'custom', label: 'Custom' },
];

export function PromptTemplateEditor({
  open,
  onOpenChange,
  template,
  onSave,
}: PromptTemplateEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState('custom');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewLanguages, setPreviewLanguages] = useState({ source: 'Arabic', target: 'Spanish' });

  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setPromptText(template.prompt_text);
      setCategory(template.category || 'custom');
    } else {
      // Reset for new template
      setName('');
      setDescription('');
      setPromptText('');
      setCategory('custom');
    }
    setError('');
  }, [template]);

  const handleSave = async () => {
    setError('');

    // Client-side validation
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!promptText.trim()) {
      setError('Prompt text is required');
      return;
    }

    const validation = validatePromptTemplate(promptText);
    if (!validation.valid) {
      setError(validation.error || 'Invalid prompt template');
      return;
    }

    setLoading(true);

    try {
      if (template) {
        // Update existing template
        const response = await fetch(`/api/prompts/${template.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            promptText: promptText.trim(),
            category: category,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update template');
        }
      } else {
        // Create new template
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            promptText: promptText.trim(),
            category: category,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create template');
        }
      }

      onSave();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const preview = previewPrompt(promptText, previewLanguages.source, previewLanguages.target);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Translation Prompt Template' : 'Create Translation Prompt Template'}
          </DialogTitle>
          <DialogDescription>
            Create reusable prompts with {'{source_lang}'} and {'{target_lang}'} placeholders. These
            will be substituted with actual language names during translation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <FloatingLabelInput
              id="name"
              name="name"
              label="Template Name"
              placeholder="e.g., Formal Academic"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <FloatingLabelInput
              id="description"
              name="description"
              label="Description"
              placeholder="Brief description of this template's purpose"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Prompt Text */}
          <div className="space-y-2">
            <Label htmlFor="promptText">Prompt Text *</Label>
            <Textarea
              id="promptText"
              placeholder={
                'You are an expert simultaneous interpreter. Translate from {source_lang} to {target_lang}...'
              }
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={6}
              disabled={loading}
              className="font-mono text-sm"
            />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Use {'{source_lang}'} and {'{target_lang}'} as placeholders for language names.
            </p>
          </div>

          {/* Preview Section */}
          <div className="space-y-2 border-t border-[rgba(128,128,128,0.3)] pt-4">
            <Label>Preview</Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <FloatingLabelInput
                id="previewSource"
                name="previewSource"
                label="Source Language"
                value={previewLanguages.source}
                onChange={(e) =>
                  setPreviewLanguages({ ...previewLanguages, source: e.target.value })
                }
                placeholder="Arabic"
                className="text-sm"
              />
              <FloatingLabelInput
                id="previewTarget"
                name="previewTarget"
                label="Target Language"
                value={previewLanguages.target}
                onChange={(e) =>
                  setPreviewLanguages({ ...previewLanguages, target: e.target.value })
                }
                placeholder="Spanish"
                className="text-sm"
              />
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-sm text-black dark:text-white">
              {preview || 'Enter prompt text to see preview...'}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
