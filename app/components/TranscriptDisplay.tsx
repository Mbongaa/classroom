'use client';

import React from 'react';
import { TranscriptSegment } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
  language: string;
  className?: string;
}

/**
 * TranscriptDisplay - Essay-style formatted transcript display
 *
 * Features:
 * - Groups consecutive statements by same speaker into paragraphs
 * - Essay/lecture text formatting for better readability
 * - Speaker names as headings
 * - Natural text flow without timestamps
 * - Scroll-friendly styling (no prose classes that conflict with ScrollShadow)
 * - Print-friendly styling
 */
export default function TranscriptDisplay({
  segments,
  language,
  className = '',
}: TranscriptDisplayProps) {
  if (!segments || segments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No transcript segments available.</p>
      </div>
    );
  }

  // Group consecutive segments by same speaker
  const groupedSegments = groupBySpeaker(segments);

  return (
    <div className={cn('max-w-none space-y-6', className)}>
      {groupedSegments.map((group, index) => (
        <div key={index}>
          {/* Speaker Name as Heading */}
          <h3 className="text-lg font-bold mb-3 text-foreground">
            {group.speaker}
          </h3>

          {/* Combined Text as Paragraph */}
          <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {group.text}
          </p>
        </div>
      ))}

      {/* Metadata Footer */}
      <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground text-center print:hidden">
        <p>
          Lecture transcript • Language: {language.toUpperCase()}
        </p>
      </div>
    </div>
  );
}

/**
 * Group consecutive segments by the same speaker into paragraphs
 * This creates a more natural essay-like flow
 */
function groupBySpeaker(segments: TranscriptSegment[]): Array<{ speaker: string; text: string }> {
  const groups: Array<{ speaker: string; text: string }> = [];

  segments.forEach((segment) => {
    const lastGroup = groups[groups.length - 1];

    // If same speaker as last group, append to existing text
    if (lastGroup && lastGroup.speaker === segment.participant_name) {
      lastGroup.text += ' ' + segment.text.trim();
    } else {
      // New speaker, create new group
      groups.push({
        speaker: segment.participant_name,
        text: segment.text.trim(),
      });
    }
  });

  return groups;
}
