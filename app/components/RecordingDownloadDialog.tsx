'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Globe } from 'lucide-react';
import PreJoinLanguageSelect from './PreJoinLanguageSelect';
import toast from 'react-hot-toast';

interface Recording {
  id: string;
  room_name: string;
  mp4_url: string | null;
  status: string;
}

interface RecordingDownloadDialogProps {
  recording: Recording;
  trigger: React.ReactNode;
}

type FormatType = 'srt' | 'vtt' | 'txt';

export default function RecordingDownloadDialog({ recording, trigger }: RecordingDownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const [transcriptionFormat, setTranscriptionFormat] = useState<FormatType>('srt');
  const [translationLanguage, setTranslationLanguage] = useState('es');
  const [translationFormat, setTranslationFormat] = useState<FormatType>('srt');
  const [downloading, setDownloading] = useState<string | null>(null);

  const isCompleted = recording.status === 'COMPLETED';

  const handleDownloadTranscription = async () => {
    setDownloading('transcription');
    try {
      const url = `/api/recordings/${recording.id}/download/transcription?format=${transcriptionFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download transcription');
      }

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${recording.room_name}_transcription.${transcriptionFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Transcription downloaded successfully');
    } catch (error) {
      console.error('Download transcription error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download transcription');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadTranslation = async () => {
    setDownloading('translation');
    try {
      const url = `/api/recordings/${recording.id}/download/translation?language=${translationLanguage}&format=${translationFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download translation');
      }

      // Download file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${recording.room_name}_translation_${translationLanguage}.${translationFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Translation downloaded successfully');
    } catch (error) {
      console.error('Download translation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to download translation');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="transcription" className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1">
            <TabsTrigger value="transcription" disabled={!isCompleted} className="gap-1.5">
              <FileText className="h-4 w-4" />
              Transcription
            </TabsTrigger>
            <TabsTrigger value="translation" disabled={!isCompleted} className="gap-1.5">
              <Globe className="h-4 w-4" />
              Translation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={transcriptionFormat} onValueChange={(value) => setTranscriptionFormat(value as FormatType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="srt">SRT (SubRip)</SelectItem>
                  <SelectItem value="vtt">VTT (WebVTT)</SelectItem>
                  <SelectItem value="txt">TXT (Plain Text)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Button
              onClick={handleDownloadTranscription}
              disabled={!isCompleted || downloading === 'transcription'}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading === 'transcription' ? 'Downloading...' : 'Download Transcription'}
            </Button>

            {!isCompleted && (
              <p className="text-sm text-muted-foreground text-center">
                Transcription only available for completed recordings
              </p>
            )}
          </TabsContent>

          <TabsContent value="translation" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <PreJoinLanguageSelect
                selectedLanguage={translationLanguage}
                onLanguageChange={setTranslationLanguage}
                disabled={!isCompleted}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <Select value={translationFormat} onValueChange={(value) => setTranslationFormat(value as FormatType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="srt">SRT (SubRip)</SelectItem>
                  <SelectItem value="vtt">VTT (WebVTT)</SelectItem>
                  <SelectItem value="txt">TXT (Plain Text)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Button
              onClick={handleDownloadTranslation}
              disabled={!isCompleted || downloading === 'translation'}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading === 'translation' ? 'Downloading...' : 'Download Translation'}
            </Button>

            {!isCompleted && (
              <p className="text-sm text-muted-foreground text-center">
                Translation only available for completed recordings
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
