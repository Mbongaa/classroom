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
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/prompts');
        if (response.ok) {
          const data = await response.json();
          const all: PromptTemplate[] = data.templates || [];

          // Sort: Khutba (Fusha) first, then alphabetical
          all.sort((a, b) => {
            const aIsKhutba = a.name.toLowerCase().includes('khutba') && a.name.toLowerCase().includes('fusha');
            const bIsKhutba = b.name.toLowerCase().includes('khutba') && b.name.toLowerCase().includes('fusha');
            if (aIsKhutba && !bIsKhutba) return -1;
            if (!aIsKhutba && bIsKhutba) return 1;
            return a.name.localeCompare(b.name);
          });

          setTemplates(all);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Auto-select first template (Khutba Fusha after sorting) whenever value is empty
  useEffect(() => {
    if (templates.length > 0 && !value) {
      onChange(templates[0].id);
    }
  }, [templates, value, onChange]);

  const selectedTemplate = templates.find((t) => t.id === value) || null;

  // Derive the select value: use the actual value, or if templates loaded and we have a match, use it
  const selectValue = value && templates.some((t) => t.id === value) ? value : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor="prompt-template">Translation Prompt Template</Label>

      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v)}
        disabled={disabled || loading}
      >
        <SelectTrigger id="prompt-template">
          <SelectValue
            placeholder={loading ? 'Loading templates...' : 'Select a template'}
          />
        </SelectTrigger>
        <SelectContent>
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
