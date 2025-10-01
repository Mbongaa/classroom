'use client';

import { useState } from 'react';
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
import PreJoinLanguageSelect from '@/app/components/PreJoinLanguageSelect';

interface CreateRoomDialogProps {
  onRoomCreated: () => void;
}

export function CreateRoomDialog({ onRoomCreated }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [roomCode, setRoomCode] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('meeting');
  const [teacherName, setTeacherName] = useState('');
  const [language, setLanguage] = useState('en'); // Default to English
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setRoomCode('');
    setRoomType('meeting');
    setTeacherName('');
    setLanguage('en');
    setDescription('');
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
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode: roomCode.trim(),
          roomType,
          teacherName: teacherName.trim() || undefined,
          language: language || undefined, // Language is already a code (en, es, etc.)
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create room');
        setLoading(false);
        return;
      }

      // Success
      resetForm();
      setOpen(false);
      onRoomCreated();
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
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Persistent Room</DialogTitle>
            <DialogDescription>
              Create a room with a memorable code that can be reused for recurring sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
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
                  <SelectItem value="meeting">Meeting (Full Permissions)</SelectItem>
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
                onLanguageChange={setLanguage}
                disabled={loading}
                isTeacher={roomType === 'classroom' || roomType === 'speech'}
              />
            </div>

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

            {/* Error message */}
            {error && (
              <div className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-3">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
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
