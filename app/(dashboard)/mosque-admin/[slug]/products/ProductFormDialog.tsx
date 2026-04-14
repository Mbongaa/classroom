'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import type { Product } from './ProductsClient';

/**
 * Create / edit dialog for a product. Same pattern as CampaignFormDialog —
 * `mode='edit'` pre-fills from the passed `product` and PATCHes, otherwise
 * POSTs to the collection endpoint.
 *
 * `slug` is locked in edit mode to avoid breaking links.
 *
 * Price is collected in EUROS but converted to CENTS before being sent
 * to the API, since the database stores cents.
 */

interface ProductFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  product?: Product;
  onSuccess: (product: Product) => void;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function ProductFormDialog({
  mode,
  open,
  onOpenChange,
  organizationId,
  product,
  onSuccess,
}: ProductFormDialogProps) {
  const isEdit = mode === 'edit';

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priceEuros, setPriceEuros] = useState('');
  const [stockValue, setStockValue] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset / hydrate whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (isEdit && product) {
      setTitle(product.title);
      setSlug(product.slug);
      setSlugTouched(true);
      setDescription(product.description ?? '');
      setCategory(product.category ?? '');
      setPriceEuros(String(product.price / 100));
      setStockValue(product.stock != null ? String(product.stock) : '');
      setImageUrl(product.image_url ?? '');
      setIsActive(product.is_active);
    } else {
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      setCategory('');
      setPriceEuros('');
      setStockValue('');
      setImageUrl('');
      setIsActive(true);
    }
    setError('');
  }, [open, isEdit, product]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!isEdit && !slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase());
    setSlugTouched(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setError('Title must be at least 2 characters');
      return;
    }
    if (!isEdit && !SLUG_RE.test(slug)) {
      setError(
        'Slug must be 3-60 lowercase letters, numbers or hyphens (no leading/trailing hyphen)',
      );
      return;
    }

    if (priceEuros.trim() === '') {
      setError('Price is required');
      return;
    }
    const parsedPrice = Number(priceEuros.replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Price must be a positive number');
      return;
    }
    const priceCents = Math.round(parsedPrice * 100);

    let stockNum: number | null = null;
    if (stockValue.trim() !== '') {
      const parsed = Number(stockValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Stock must be a non-negative number (or leave blank for unlimited)');
        return;
      }
      stockNum = Math.floor(parsed);
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      description: description.trim() || null,
      category: category.trim() || null,
      price: priceCents,
      stock: stockNum,
      image_url: imageUrl.trim() || null,
      is_active: isActive,
    };
    if (!isEdit) {
      payload.slug = slug;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/organizations/${organizationId}/products/${product!.id}`
        : `/api/organizations/${organizationId}/products`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} product`);
      }
      onSuccess(data.product);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[520px]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isEdit ? 'Edit product' : 'New product'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update the details for this product.'
                : 'Add a new product to your shop.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-y-auto py-2">
            <div className="grid gap-2">
              <Label htmlFor="product-title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-title"
                placeholder="e.g. Quran — Sahih International"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                disabled={submitting}
                maxLength={200}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="product-slug"
                placeholder="e.g. quran-sahih-international"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={submitting || isEdit}
                maxLength={60}
                required
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEdit
                  ? 'Slug cannot be changed — it would break links that have already been shared.'
                  : 'Used in the shop URL: /shop/<org>/<slug>. Lowercase letters, numbers and hyphens.'}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                placeholder="Product details. Optional."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                maxLength={5000}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="product-price">
                  Price (€) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="product-price"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 12.50"
                  value={priceEuros}
                  onChange={(e) => setPriceEuros(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-stock">Stock</Label>
                <Input
                  id="product-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Unlimited"
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  disabled={submitting}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Leave blank for unlimited stock.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                placeholder="books, clothing, food…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
                maxLength={50}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Free-text tag for grouping products.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-image">Image URL</Label>
              <Input
                id="product-image"
                type="url"
                placeholder="https://…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={submitting}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct link to a product image. Optional.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-[rgba(128,128,128,0.3)] p-3">
              <input
                id="product-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4"
              />
              <Label htmlFor="product-active" className="cursor-pointer text-sm font-normal">
                Active — visible in the shop and available for purchase
              </Label>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-full">
              {submitting
                ? isEdit
                  ? 'Saving…'
                  : 'Creating…'
                : isEdit
                  ? 'Save changes'
                  : 'Create product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
