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
      <Label htmlFor="prompt-template">Translation Prompt Template (Optional)</Label>

      <Select
        value={value || 'none'}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger id="prompt-template">
          <SelectValue
            placeholder={loading ? 'Loading templates...' : 'Select a template (optional)'}
          />
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

    </div>
  );
}
