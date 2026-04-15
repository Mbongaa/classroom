'use client';

import { useState, useTransition } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TrashIcon } from '@/components/ui/trash';
import { ProductFormDialog } from './ProductFormDialog';

export interface Product {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ProductsClientProps {
  organizationId: string;
  organizationSlug: string;
  initialProducts: Product[];
  canManage: boolean;
  canDelete: boolean;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/** Sort: active first, then by sort_order, then by created_at desc. */
function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function ProductsClient({
  organizationId,
  organizationSlug,
  initialProducts,
  canManage,
  canDelete,
}: ProductsClientProps) {
  const t = useTranslations('mosqueAdmin.products');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reordering, setReordering] = useState(false);

  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

  function handleCreated(created: Product) {
    setProducts((prev) => sortProducts([created, ...prev]));
  }

  function handleUpdated(updated: Product) {
    setProducts((prev) =>
      sortProducts(prev.map((p) => (p.id === updated.id ? updated : p))),
    );
  }

  function handleDeleted(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function persistOrder(reordered: Product[]) {
    setReordering(true);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/products/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: reordered.map((p) => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('toast.reorderFailed'));
      }
      toast.success(t('toast.orderUpdated'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.reorderFailed'));
    } finally {
      setReordering(false);
    }
  }

  function handleMove(productId: string, direction: 'up' | 'down') {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const group = product.is_active ? activeProducts : inactiveProducts;
    const idx = group.findIndex((p) => p.id === productId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;

    const newGroup = [...group];
    [newGroup[idx], newGroup[swapIdx]] = [newGroup[swapIdx], newGroup[idx]];

    const updatedGroup = newGroup.map((p, i) => ({ ...p, sort_order: i }));
    const otherGroup = product.is_active ? inactiveProducts : activeProducts;
    const merged = sortProducts([...updatedGroup, ...otherGroup]);
    setProducts(merged);
    persistOrder(merged);
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)} className="rounded-full">
            {t('list.newProduct')}
          </Button>
          <ProductFormDialog
            mode="create"
            open={createOpen}
            onOpenChange={setCreateOpen}
            organizationId={organizationId}
            onSuccess={handleCreated}
          />
        </div>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-base font-medium">{t('list.emptyTitle')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('list.emptyDescription')}
            </p>
            {canManage && (
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-6 rounded-full"
                variant="default"
              >
                {t('list.addFirst')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(128,128,128,0.3)] text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {canManage && <th className="px-4 py-3">{t('table.order')}</th>}
                    <th className="px-4 py-3">{t('table.product')}</th>
                    <th className="px-4 py-3">{t('table.category')}</th>
                    <th className="px-4 py-3">{t('table.price')}</th>
                    <th className="px-4 py-3">{t('table.stock')}</th>
                    <th className="px-4 py-3">{t('table.active')}</th>
                    <th className="px-4 py-3 text-right">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const group = product.is_active ? activeProducts : inactiveProducts;
                    const idxInGroup = group.findIndex((p) => p.id === product.id);
                    return (
                      <ProductRow
                        key={product.id}
                        product={product}
                        organizationId={organizationId}
                        organizationSlug={organizationSlug}
                        canManage={canManage}
                        canDelete={canDelete}
                        isFirst={idxInGroup === 0}
                        isLast={idxInGroup === group.length - 1}
                        reordering={reordering}
                        onMove={handleMove}
                        onEdit={() => setEditing(product)}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <ProductFormDialog
          mode="edit"
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          organizationId={organizationId}
          product={editing}
          onSuccess={(updated) => {
            handleUpdated(updated);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

interface ProductRowProps {
  product: Product;
  organizationId: string;
  organizationSlug: string;
  canManage: boolean;
  canDelete: boolean;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onEdit: () => void;
  onUpdated: (product: Product) => void;
  onDeleted: (id: string) => void;
}

function ProductRow({
  product,
  organizationId,
  organizationSlug,
  canManage,
  canDelete,
  isFirst,
  isLast,
  reordering,
  onMove,
  onEdit,
  onUpdated,
  onDeleted,
}: ProductRowProps) {
  const t = useTranslations('mosqueAdmin.products');
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function handleToggleActive(next: boolean) {
    if (!canManage) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/organizations/${organizationId}/products/${product.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: next }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || t('form.errors.updateFailed'));
        }
        onUpdated(data.product);
        toast.success(next ? t('toast.activated') : t('toast.deactivated'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toast.updateFailed'));
      }
    });
  }

  async function handleDelete() {
    if (!canDelete) return;
    const confirmed = window.confirm(t('confirmDelete', { title: product.title }));
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/products/${product.id}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || t('toast.deleteFailed'));
      }
      onDeleted(product.id);
      toast.success(t('toast.deleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b border-[rgba(128,128,128,0.15)] last:border-b-0">
      {canManage && (
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onMove(product.id, 'up')}
              disabled={isFirst || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label={t('table.moveUp')}
            >
              <IconArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMove(product.id, 'down')}
              disabled={isLast || reordering || pending}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
              aria-label={t('table.moveDown')}
            >
              <IconArrowDown className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{product.title}</span>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 max-w-md text-xs text-slate-500 dark:text-slate-400">
              {product.description}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {product.category ? (
          <Badge variant="outline">{product.category}</Badge>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 font-medium">{formatEuro(product.price)}</td>
      <td className="px-4 py-3">
        {product.stock === null ? (
          <span className="text-xs text-slate-400">{t('table.unlimited')}</span>
        ) : product.stock === 0 ? (
          <Badge variant="destructive" className="text-xs">{t('table.soldOut')}</Badge>
        ) : (
          <span className="font-medium">{product.stock}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={product.is_active}
            disabled={!canManage || pending}
            onCheckedChange={handleToggleActive}
            aria-label={t('table.toggleActiveAria', { title: product.title })}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {product.is_active ? t('table.live') : t('table.hidden')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={deleting || pending}
            >
              {t('table.edit')}
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleDelete}
              disabled={deleting || pending}
              title={deleting ? t('table.deleting') : t('table.deleteProduct')}
              aria-label={t('table.deleteProduct')}
            >
              <TrashIcon size={16} />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
