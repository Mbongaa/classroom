'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye } from 'lucide-react';
import { previewPrompt } from '@/lib/prompt-utils';
import type { PromptTemplate } from '@/lib/prompt-utils';

interface PromptTemplateListProps {
  templates: PromptTemplate[];
  onEdit: (template: PromptTemplate) => void;
  onDelete: (templateId: string) => void;
}

export function PromptTemplateList({ templates, onEdit, onDelete }: PromptTemplateListProps) {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const handleDeleteClick = (template: PromptTemplate) => {
    if (
      window.confirm(
        `Delete "${template.name}"?\n\nThis will permanently delete this template. Classrooms using this template will no longer have a custom prompt assigned.`,
      )
    ) {
      onDelete(template.id);
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'formal':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'conversational':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'technical':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'religious':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">
            No prompt templates yet. Create your first template to customize translation behavior.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {templates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.is_public && (
                    <Badge variant="outline" className="text-xs">
                      Public
                    </Badge>
                  )}
                  {template.category && (
                    <Badge className={getCategoryColor(template.category)}>
                      {template.category}
                    </Badge>
                  )}
                </div>
                {template.description && <CardDescription>{template.description}</CardDescription>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setExpandedTemplate(expandedTemplate === template.id ? null : template.id)
                  }
                  title="View prompt"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {!template.is_public && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(template)}
                      title="Edit template"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(template)}
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          {expandedTemplate === template.id && (
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-1">Prompt Template:</h4>
                  <div className="p-3 bg-muted rounded-md font-mono text-xs whitespace-pre-wrap">
                    {template.prompt_text}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Preview (Arabic → Spanish):</h4>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {previewPrompt(template.prompt_text, 'Arabic', 'Spanish')}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-1">Preview (Arabic → French):</h4>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {previewPrompt(template.prompt_text, 'Arabic', 'French')}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
