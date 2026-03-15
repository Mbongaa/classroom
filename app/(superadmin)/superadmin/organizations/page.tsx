'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/UserContext';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, Pencil, Trash2, Loader2 } from 'lucide-react';

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  pages.push(1);
  if (currentPage > 3) pages.push('ellipsis');
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);
  return pages;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  subscription_status: string;
  created_at: string;
  member_count: number;
  classroom_count: number;
}

type SortField = 'name' | 'subscription_tier' | 'subscription_status' | 'member_count' | 'classroom_count' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function SuperadminOrganizationsPage() {
  const { profile, loading: userLoading } = useUser();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Edit dialog state
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', subscription_tier: '', subscription_status: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && (!profile || !profile.is_superadmin)) {
      router.replace('/dashboard');
      return;
    }
  }, [profile, userLoading, router]);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/superadmin/organizations');
      if (!res.ok) {
        throw new Error('Failed to fetch organizations');
      }
      const data = await res.json();
      setOrganizations(data.organizations);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.is_superadmin) {
      fetchOrganizations();
    }
  }, [profile]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const statusPriority: Record<string, number> = {
    past_due: 0,
    trialing: 1,
    incomplete: 2,
    active: 3,
    canceled: 4,
  };

  const sortedOrganizations = [...organizations].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (sortField === 'member_count' || sortField === 'classroom_count') {
      aVal = a[sortField];
      bVal = b[sortField];
    } else if (sortField === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sortField === 'subscription_tier') {
      aVal = a.subscription_tier.toLowerCase();
      bVal = b.subscription_tier.toLowerCase();
    } else if (sortField === 'subscription_status') {
      aVal = statusPriority[a.subscription_status] ?? 99;
      bVal = statusPriority[b.subscription_status] ?? 99;
    } else {
      aVal = a.created_at;
      bVal = b.created_at;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedOrganizations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrganizations = sortedOrganizations.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  function getStatusVariant(status: string) {
    switch (status) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'warning';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'outline';
      default:
        return 'secondary';
    }
  }

  // Edit handlers
  const openEditDialog = (org: Organization) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      slug: org.slug,
      subscription_tier: org.subscription_tier,
      subscription_status: org.subscription_status,
    });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editOrg) return;
    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/superadmin/organizations/${editOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update organization');
      }

      setEditOrg(null);
      await fetchOrganizations();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete handlers
  const openDeleteDialog = (org: Organization) => {
    setDeleteOrg(org);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteOrg) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/superadmin/organizations/${deleteOrg.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete organization');
      }

      setDeleteOrg(null);
      setOrganizations((prev) => prev.filter((o) => o.id !== deleteOrg.id));
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (userLoading || !profile?.is_superadmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black dark:text-white">Organizations</h1>
        <p className="text-slate-500 dark:text-slate-400">All organizations on the platform.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(128,128,128,0.3)] bg-white dark:bg-black text-black dark:text-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('name')}
                  className="h-8"
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Slug</TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('subscription_tier')}
                  className="h-8"
                >
                  Tier
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('subscription_status')}
                  className="h-8"
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('member_count')}
                  className="h-8"
                >
                  Members
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('classroom_count')}
                  className="h-8"
                >
                  Classrooms
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('created_at')}
                  className="h-8"
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedOrganizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-center">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground text-center">{org.slug}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="capitalize">
                      {org.subscription_tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getStatusVariant(org.subscription_status)} className="capitalize">
                      {org.subscription_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{org.member_count}</TableCell>
                  <TableCell className="text-center">{org.classroom_count}</TableCell>
                  <TableCell className="text-muted-foreground text-center whitespace-nowrap">
                    {new Date(org.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(org)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {org.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                        onClick={() => openDeleteDialog(org)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete {org.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedOrganizations.length)} of{' '}
            {sortedOrganizations.length} organizations
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => goToPage(currentPage - 1)}
                  className={
                    currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              {getPageNumbers(currentPage, totalPages).map((page, idx) =>
                page === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => goToPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => goToPage(currentPage + 1)}
                  className={
                    currentPage === totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Edit Organization Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update organization details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={editForm.slug}
                onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Subscription Tier</Label>
              <Select
                value={editForm.subscription_tier}
                onValueChange={(v) => setEditForm((f) => ({ ...f, subscription_tier: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subscription Status</Label>
              <Select
                value={editForm.subscription_status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, subscription_status: v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && (
              <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)} disabled={editLoading}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={!!deleteOrg} onOpenChange={(open) => !open && setDeleteOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteOrg?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-600 dark:text-slate-300">
            <p>This action is <strong className="text-red-600 dark:text-red-400">permanent and irreversible</strong>. The following will be deleted:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All <strong>{deleteOrg?.member_count}</strong> member profiles and auth accounts</li>
              <li>All <strong>{deleteOrg?.classroom_count}</strong> classrooms and their participants</li>
              <li>All invitations and translation prompt templates</li>
            </ul>
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
              <p className="font-medium">Before deleting:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                <li>Cancel any active Stripe subscription manually</li>
                <li>Recordings in S3/R2 storage will not be deleted automatically</li>
              </ul>
            </div>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrg(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
