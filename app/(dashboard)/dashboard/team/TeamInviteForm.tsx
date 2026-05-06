'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Send } from 'lucide-react';
import { inviteOrganizationMember } from '@/lib/actions/team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TeamInviteForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('role', role);

    try {
      const result = await inviteOrganizationMember(formData);
      if (!result.success) {
        toast.error(result.error || 'Could not send invitation.');
        return;
      }
      toast.success(result.message || 'Invitation sent.');
      setEmail('');
      setRole('teacher');
    } catch {
      toast.error('Could not send invitation.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
      <div className="space-y-2">
        <Label htmlFor="team-email">Email</Label>
        <Input
          id="team-email"
          type="email"
          placeholder="teacher@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="team-role">Role</Label>
        <select
          id="team-role"
          value={role}
          onChange={(event) => setRole(event.target.value as 'teacher' | 'admin')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="teacher">Teacher - translation only</option>
          <option value="admin">Admin - translation and finance</option>
        </select>
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Invite
        </Button>
      </div>
    </form>
  );
}
