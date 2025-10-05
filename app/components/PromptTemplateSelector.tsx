'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { previewPrompt } from '@/lib/prompt-utils';
import type { PromptTemplate } from '@/lib/prompt-utils';

interface PromptTemplateSelectorProps {
  value: string | null;
  onChange: (templateId: string | null) => void;
  disabled?: boolean;
}

export function PromptTemplateSelector({
  value,
  onChange,
  disabled = false,
}: PromptTemplateSelectorProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/prompts');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  useEffect(() => {
    // Find and set the selected template when value changes
    if (value) {
      const template = templates.find((t) => t.id === value);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [value, templates]);

  const handleValueChange = (newValue: string) => {
    if (newValue === 'none') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="prompt-template">Translation Prompt Template (Optional)</Label>
        {selectedTemplate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show Preview
              </>
            )}
          </Button>
        )}
      </div>

      <Select value={value || 'none'} onValueChange={handleValueChange} disabled={disabled || loading}>
        <SelectTrigger id="prompt-template">
          <SelectValue placeholder={loading ? 'Loading templates...' : 'Select a template (optional)'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">No custom prompt (use default)</span>
          </SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center gap-2">
                <span>{template.name}</span>
                {template.is_public && (
                  <Badge variant="outline" className="text-xs">
                    Public
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedTemplate && (
        <p className="text-sm text-muted-foreground">
          {selectedTemplate.description || 'Custom translation prompt template'}
        </p>
      )}

      {showPreview && selectedTemplate && (
        <div className="p-4 bg-muted rounded-md space-y-3 mt-2">
          <div>
            <h4 className="text-sm font-medium mb-1">Template Text:</h4>
            <div className="p-2 bg-background rounded text-xs font-mono whitespace-pre-wrap">
              {selectedTemplate.prompt_text}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Preview (Arabic → Spanish):</h4>
            <div className="p-2 bg-background rounded text-sm">
              {previewPrompt(selectedTemplate.prompt_text, 'Arabic', 'Spanish')}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Preview (Arabic → French):</h4>
            <div className="p-2 bg-background rounded text-sm">
              {previewPrompt(selectedTemplate.prompt_text, 'Arabic', 'French')}
            </div>
          </div>
          <p className="text-xs text-muted-foreground italic">
            This template will work for any language students select in the lobby.
          </p>
        </div>
      )}
    </div>
  );
}
