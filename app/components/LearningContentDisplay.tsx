'use client';

import React from 'react';
import { LearningContent } from '@/lib/gemini/learning-content-generator';
import { Button } from '@/components/ui/button';
import { Tabs, Tab, Card, CardBody } from '@heroui/react';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { GraduationCap, Lightbulb, Printer, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LearningContentDisplayProps {
  content: LearningContent;
  metadata?: {
    roomName?: string;
    teacherName?: string;
    targetLanguage?: string;
  };
}

/**
 * LearningContentDisplay - Single-Page App with HeroUI Vertical Tabs
 *
 * Fixed-height layout with professional vertical sidebar navigation.
 * Uses HeroUI tabs for beautiful animations and better UX.
 */
export default function LearningContentDisplay({
  content,
  metadata,
}: LearningContentDisplayProps) {
  const { summary, thematic_breakdown } = content;

  const handlePrint = () => {
    window.print();
    toast.success('Opening print dialog...');
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Bayaan Header - Consolidated */}
      <header className="shrink-0 h-16 border-b border-[rgba(128,128,128,0.3)] bg-background print:border-b-2">
        <div className="flex h-full items-center justify-between px-6">
          {/* Left: Bayaan Branding + Room Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-foreground">Bayaan Classroom</span>
            </div>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">
                {metadata?.roomName || 'Learning Content'}
              </span>
              {metadata?.teacherName && (
                <span className="text-muted-foreground">• {metadata.teacherName}</span>
              )}
            </div>
          </div>

          {/* Right: Language + Theme Toggle */}
          <div className="flex items-center gap-3">
            {metadata?.targetLanguage && (
              <div className="text-sm font-medium text-muted-foreground">
                {metadata.targetLanguage.toUpperCase()}
              </div>
            )}
            <div className="print:hidden">
              <ThemeToggleButton start="top-right" />
            </div>
          </div>
        </div>
      </header>

      {/* Content Area with HeroUI Vertical Tabs */}
      <div className="flex-1 p-6">
        <Tabs aria-label="Learning content sections" isVertical={true}>
          {/* Summary Tab */}
          <Tab key="summary" title="Summary">
            <Card>
              <CardBody>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                  <Lightbulb className="h-6 w-6 text-yellow-500" />
                  {summary.title}
                </h2>
                <div className="space-y-4">
                  {summary.key_points.map((point, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-default-100">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </span>
                      <span className="text-base leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Tab>

          {/* Theme Tabs */}
          {thematic_breakdown.map((theme, index) => (
            <Tab key={`theme-${index}`} title={`Theme ${index + 1}`}>
              <Card>
                <CardBody>
                  <div className="flex items-start gap-3 mb-6">
                    <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                      {index + 1}
                    </span>
                    <h2 className="text-2xl font-bold pt-1">
                      {theme.theme_title}
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {theme.theme_content.split('\n\n').map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-base leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </Tab>
          ))}
        </Tabs>
      </div>

      {/* Fixed Footer */}
      <footer className="shrink-0 h-14 border-t border-[rgba(128,128,128,0.3)] bg-background px-6 flex items-center justify-between print:border-t-2">
        <div className="text-sm text-muted-foreground print:text-black">
          Generated with AI •{' '}
          {new Date().toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </footer>
    </div>
  );
}
