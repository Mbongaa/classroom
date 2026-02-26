'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Download, FileText, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface Recording {
  id: string;
  room_name: string;
  mp4_url: string | null;
  status: string;
}

interface RecordingDownloadDialogProps {
  recording?: Recording;
  sessionId?: string;
  roomName?: string;
  trigger: React.ReactNode;
}

type FormatType = 'srt' | 'vtt' | 'txt';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  nl: 'Nederlands',
  ru: 'Русский',
  ja: '日本語',
  'zh-CN': '中文',
  ar: 'العربية (Fusha)',
  'ar-mixed': 'عربي مختلط (Mixed)',
  'ar-darija': 'الدارجة (Darija)',
  hi: 'हिन्दी',
  pt: 'Português',
  ko: '한국어',
  tr: 'Türkçe',
};

export default function RecordingDownloadDialog({
  recording,
  sessionId,
  roomName: roomNameProp,
  trigger,
}: RecordingDownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const [transcriptionFormat, setTranscriptionFormat] = useState<FormatType>('srt');
  const [translationLanguage, setTranslationLanguage] = useState('');
  const [translationFormat, setTranslationFormat] = useState<FormatType>('srt');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [transcriptionLanguages, setTranscriptionLanguages] = useState<string[]>([]);
  const [translationLanguages, setTranslationLanguages] = useState<string[]>([]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);

  // Session mode: use session routes directly. Recording mode: use recording routes.
  const useSessionMode = !!sessionId;
  const displayName = roomNameProp || recording?.room_name || 'session';

  // Fetch available languages when dialog opens
  useEffect(() => {
    if (!open) return;

    const languagesUrl = useSessionMode
      ? `/api/sessions/${sessionId}/languages`
      : `/api/recordings/${recording!.id}/languages`;

    setLoadingLanguages(true);
    fetch(languagesUrl)
      .then((res) => res.json())
      .then((data) => {
        setTranscriptionLanguages(data.transcriptionLanguages || []);
        setTranslationLanguages(data.translationLanguages || []);
        if (data.translationLanguages?.length > 0 && !translationLanguage) {
          setTranslationLanguage(data.translationLanguages[0]);
        }
      })
      .catch((err) => console.error('[DownloadDialog] Failed to fetch languages:', err))
      .finally(() => setLoadingLanguages(false));
  }, [open, sessionId, recording?.id, useSessionMode]);

  const handleDownloadTranscription = async () => {
    setDownloading('transcription');
    try {
      const url = useSessionMode
        ? `/api/sessions/${sessionId}/download/transcription?format=${transcriptionFormat}`
        : `/api/recordings/${recording!.id}/download/transcription?format=${transcriptionFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download transcription');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${displayName}_transcription.${transcriptionFormat}`;
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
      const url = useSessionMode
        ? `/api/sessions/${sessionId}/download/translation?language=${translationLanguage}&format=${translationFormat}`
        : `/api/recordings/${recording!.id}/download/translation?language=${translationLanguage}&format=${translationFormat}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to download translation');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${displayName}_translation_${translationLanguage}.${translationFormat}`;
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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Download Options</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="transcription" className="w-full overflow-y-auto min-h-0">
          <TabsList className="grid w-full grid-cols-2 gap-1">
            <TabsTrigger value="transcription" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Transcription
            </TabsTrigger>
            <TabsTrigger value="translation" className="gap-1.5">
              <Globe className="h-4 w-4" />
              Translation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4 mt-4">
            {loadingLanguages ? (
              <p className="text-sm text-muted-foreground text-center py-2">Loading...</p>
            ) : transcriptionLanguages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No transcriptions available for this session
              </p>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  Available: {transcriptionLanguages.map((l) => LANGUAGE_LABELS[l] || l).join(', ')}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <Select
                    value={transcriptionFormat}
                    onValueChange={(value) => setTranscriptionFormat(value as FormatType)}
                  >
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
                  disabled={downloading === 'transcription'}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading === 'transcription' ? 'Downloading...' : 'Download Transcription'}
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="translation" className="space-y-4 mt-4">
            {loadingLanguages ? (
              <p className="text-sm text-muted-foreground text-center py-2">Loading...</p>
            ) : translationLanguages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No translations available for this session
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Language</label>
                  <Select
                    value={translationLanguage}
                    onValueChange={setTranslationLanguage}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {translationLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {LANGUAGE_LABELS[lang] || lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <Select
                    value={translationFormat}
                    onValueChange={(value) => setTranslationFormat(value as FormatType)}
                  >
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
                  disabled={downloading === 'translation' || !translationLanguage}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloading === 'translation' ? 'Downloading...' : 'Download Translation'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
