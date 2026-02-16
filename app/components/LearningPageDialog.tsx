'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import PreJoinLanguageSelect from './PreJoinLanguageSelect';
import { GraduationCap, ExternalLink } from 'lucide-react';

interface LearningPageDialogProps {
  recordingId: string;
  roomName: string;
  trigger: React.ReactNode;
}

/**
 * LearningPageDialog
 *
 * Modal dialog for language selection before opening the AI-generated learning page.
 * Features:
 * - Language selection dropdown
 * - Opens learning page in new tab
 * - User-friendly instructions
 */
export default function LearningPageDialog({
  recordingId,
  roomName,
  trigger,
}: LearningPageDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const handleOpenLearningPage = () => {
    // Construct learning page URL with language parameter
    const learningPageUrl = `/learn/${recordingId}?lang=${selectedLanguage}`;

    // Open in new tab
    window.open(learningPageUrl, '_blank', 'noopener,noreferrer');

    // Close dialog
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            Start Learning
          </DialogTitle>
          <DialogDescription className="text-base">
            Generate an AI-powered learning page from this lecture. Choose your preferred language
            to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto min-h-0">
          {/* Room Name Display */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Lecture</label>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium">{roomName}</p>
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Language</label>
            <PreJoinLanguageSelect
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              disabled={false}
            />
            <p className="text-xs text-muted-foreground">
              The learning content will be generated and translated into your selected language.
            </p>
          </div>

          <Separator />

          {/* What to Expect Section */}
          <div className="space-y-3 text-sm">
            <p className="font-medium">What to expect:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>AI will analyze the lecture and create structured learning content</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Content includes key takeaways and thematic breakdowns</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Generation may take 10-30 seconds depending on lecture length</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>You can print or save the page as PDF for offline study</span>
              </li>
            </ul>
          </div>

          <Separator />

          {/* Action Button */}
          <Button onClick={handleOpenLearningPage} className="w-full" size="lg">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Learning Page
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            The learning page will open in a new tab
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
