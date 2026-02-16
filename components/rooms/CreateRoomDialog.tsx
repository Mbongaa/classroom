'use client';

import { useState, useEffect } from 'react';
import { RoomType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import PreJoinLanguageSelect from '@/app/components/PreJoinLanguageSelect';
import { PromptTemplateSelector } from '@/app/components/PromptTemplateSelector';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CreateRoomDialogProps {
  onRoomCreated: (newRoom?: any) => void;
}

export function CreateRoomDialog({ onRoomCreated }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [roomCode, setRoomCode] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('classroom');
  const [teacherName, setTeacherName] = useState('');
  const [language, setLanguage] = useState('en'); // Default to English
  const [description, setDescription] = useState('');
  const [translationPromptId, setTranslationPromptId] = useState<string | null>(null);

  // Advanced STT settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contextWindowSize, setContextWindowSize] = useState(12);
  const [maxDelay, setMaxDelay] = useState(3.5);
  const [punctuationSensitivity, setPunctuationSensitivity] = useState(0.5);

  // Templates for auto-selection
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch templates when dialog opens
  useEffect(() => {
    if (open && templates.length === 0) {
      fetch('/api/prompts')
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.templates) {
            setTemplates(data.templates);
          }
        })
        .catch(() => {});
    }
  }, [open, templates.length]);

  // Auto-select appropriate template based on language
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);

    if (newLanguage === 'ar') {
      // Arabic Fusha → Khutba (Fusha) template
      const khutbaTemplate = templates.find(
        (t) => t.name.toLowerCase().includes('khutba') && t.name.toLowerCase().includes('fusha')
      );
      if (khutbaTemplate) {
        setTranslationPromptId(khutbaTemplate.id);
      }
    } else {
      // Any other language → Islamic context translation (other) template
      const islamicTemplate = templates.find(
        (t) => t.name.toLowerCase().includes('islamic') && t.name.toLowerCase().includes('other')
      );
      if (islamicTemplate) {
        setTranslationPromptId(islamicTemplate.id);
      }
    }
  };

  const resetForm = () => {
    setRoomCode('');
    setRoomType('classroom');
    setTeacherName('');
    setLanguage('en');
    setDescription('');
    setTranslationPromptId(null);
    setShowAdvanced(false);
    setContextWindowSize(12);
    setMaxDelay(3.5);
    setPunctuationSensitivity(0.5);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!roomCode.trim()) {
      setError('Room code is required');
      return;
    }

    if (!/^[a-zA-Z0-9-]{4,20}$/.test(roomCode)) {
      setError('Room code must be 4-20 alphanumeric characters or hyphens');
      return;
    }

    if ((roomType === 'classroom' || roomType === 'speech') && !teacherName.trim()) {
      setError(`Teacher name is required for ${roomType} rooms`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode: roomCode.trim(),
          name: teacherName.trim() || roomCode.trim(), // Classroom name (teacher name or room code)
          description: description.trim() || undefined,
          roomType: roomType, // ✅ FIX: Include room type in request
          settings: {
            language: language || 'en',
            enable_recording: roomType === 'classroom',
            enable_chat: true,
            max_participants: 100,
          },
          translationPromptId: translationPromptId,
          contextWindowSize: contextWindowSize,
          maxDelay: maxDelay,
          punctuationSensitivity: punctuationSensitivity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create room');
        setLoading(false);
        return;
      }

      // Success - pass the newly created room to the callback
      resetForm();
      setOpen(false);

      // Pass the created room data for optimistic update
      onRoomCreated(data.classroom);
    } catch (err) {
      setError('Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">Create Room</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create Persistent Room</DialogTitle>
            <DialogDescription>
              Create a room with a memorable code that can be reused for recurring sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 overflow-y-auto min-h-0">
            {/* Room Code */}
            <div className="grid gap-2">
              <Label htmlFor="roomCode">
                Room Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="roomCode"
                placeholder="e.g., MATH101"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                disabled={loading}
                maxLength={20}
                className="focus:ring-4 focus:ring-[#434549] focus:ring-offset-1 focus:ring-offset-[#b8b2b2] hover:border-[#6b7280]"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                4-20 alphanumeric characters or hyphens
              </p>
            </div>

            {/* Room Type */}
            <div className="grid gap-2">
              <Label htmlFor="roomType">
                Room Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={roomType}
                onValueChange={(value) => setRoomType(value as RoomType)}
                disabled={loading}
              >
                <SelectTrigger id="roomType">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classroom">Classroom (Teacher/Student Roles)</SelectItem>
                  <SelectItem value="speech">Speech (Speaker/Listener Roles)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Teacher/Speaker Name (conditional) */}
            {(roomType === 'classroom' || roomType === 'speech') && (
              <div className="grid gap-2">
                <Label htmlFor="teacherName">
                  {roomType === 'classroom' ? 'Teacher' : 'Speaker'} Name{' '}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="teacherName"
                  placeholder={`Enter ${roomType === 'classroom' ? 'teacher' : 'speaker'} name`}
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  disabled={loading}
                  maxLength={100}
                  className="focus:ring-4 focus:ring-[#434549] focus:ring-offset-1 focus:ring-offset-[#b8b2b2] hover:border-[#6b7280]"
                />
              </div>
            )}

            {/* Language (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="language">Language (Optional)</Label>
              <PreJoinLanguageSelect
                selectedLanguage={language}
                onLanguageChange={handleLanguageChange}
                disabled={loading}
                isTeacher={roomType === 'classroom' || roomType === 'speech'}
              />
            </div>

            {/* Translation Prompt Template (optional) */}
            <PromptTemplateSelector
              value={translationPromptId}
              onChange={setTranslationPromptId}
              disabled={loading}
            />

            {/* Description (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this room"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Advanced Settings (collapsible) */}
            <div className="rounded-lg bg-secondary/30">
              <Button
                type="button"
                variant="ghost"
                className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg"
                onClick={() => setShowAdvanced(!showAdvanced)}
                disabled={loading}
              >
                <span className="font-medium text-sm text-slate-700 dark:text-slate-200">Advanced Settings</span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                )}
              </Button>

              {showAdvanced && (
                <div className="grid gap-4 p-4 pt-2">
                  {/* Context Window Size */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contextWindow">Context Window Size</Label>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {contextWindowSize} pairs
                      </span>
                    </div>
                    <Slider
                      id="contextWindow"
                      min={3}
                      max={20}
                      step={1}
                      value={[contextWindowSize]}
                      onValueChange={(value) => setContextWindowSize(value[0])}
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Number of previous sentence pairs to include for translation context (higher =
                      more context, more tokens)
                    </p>
                  </div>

                  {/* Max Delay */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxDelay">Max Delay</Label>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{maxDelay.toFixed(1)}s</span>
                    </div>
                    <Slider
                      id="maxDelay"
                      min={1.0}
                      max={5.0}
                      step={0.5}
                      value={[maxDelay]}
                      onValueChange={(value) => setMaxDelay(value[0])}
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Maximum delay before finalizing transcription (higher = more accurate, more
                      latency)
                    </p>
                  </div>

                  {/* Punctuation Sensitivity */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="punctuation">Punctuation Sensitivity</Label>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {punctuationSensitivity.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      id="punctuation"
                      min={0.0}
                      max={1.0}
                      step={0.1}
                      value={[punctuationSensitivity]}
                      onValueChange={(value) => setPunctuationSensitivity(value[0])}
                      disabled={loading}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      How aggressive to be with adding punctuation (0 = minimal, 1 = maximum)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-3">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="rounded-full">
              {loading ? 'Creating...' : 'Create Room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
