const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

interface ValidatedFields {
  fields: {
    slug?: string;
    title?: string;
    description?: string | null;
    price?: number;
    category?: string | null;
    image_url?: string | null;
    stock?: number | null;
    is_active?: boolean;
  };
}

export function validateProductBody(
  body: Record<string, unknown>,
  { mode }: { mode: 'create' | 'update' },
): ValidatedFields | { error: string } {
  const fields: ValidatedFields['fields'] = {};

  // title — required on create, optional on update
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return { error: 'title must be a string' };
    }
    const trimmed = body.title.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      return { error: 'title must be 2-200 characters' };
    }
    fields.title = trimmed;
  } else if (mode === 'create') {
    return { error: 'title is required' };
  }

  // slug — required on create, not accepted on update
  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      return { error: 'slug must be a string' };
    }
    const normalised = body.slug.trim().toLowerCase();
    if (!SLUG_RE.test(normalised)) {
      return {
        error:
          'slug must be 3-60 lowercase letters, numbers or hyphens, starting and ending with an alphanumeric character',
      };
    }
    fields.slug = normalised;
  } else if (mode === 'create') {
    return { error: 'slug is required' };
  }

  // description — optional, nullable
  if (body.description !== undefined) {
    if (body.description === null || body.description === '') {
      fields.description = null;
    } else if (typeof body.description !== 'string') {
      return { error: 'description must be a string or null' };
    } else {
      const trimmed = body.description.trim();
      if (trimmed.length > 5000) {
        return { error: 'description must be at most 5000 characters' };
      }
      fields.description = trimmed;
    }
  }

  // price — required on create, in cents (positive integer)
  if (body.price !== undefined) {
    const num = Number(body.price);
    if (!Number.isFinite(num) || num <= 0) {
      return { error: 'price must be a positive number of cents' };
    }
    fields.price = Math.floor(num);
  } else if (mode === 'create') {
    return { error: 'price is required' };
  }

  // category — optional, nullable free-text tag
  if (body.category !== undefined) {
    if (body.category === null || body.category === '') {
      fields.category = null;
    } else if (typeof body.category !== 'string') {
      return { error: 'category must be a string or null' };
    } else {
      const trimmed = body.category.trim();
      if (trimmed.length > 50) {
        return { error: 'category must be at most 50 characters' };
      }
      fields.category = trimmed;
    }
  }

  // image_url — optional, nullable
  if (body.image_url !== undefined) {
    if (body.image_url === null || body.image_url === '') {
      fields.image_url = null;
    } else if (typeof body.image_url !== 'string') {
      return { error: 'image_url must be a string or null' };
    } else {
      const trimmed = body.image_url.trim();
      if (trimmed.length > 2000) {
        return { error: 'image_url must be at most 2000 characters' };
      }
      fields.image_url = trimmed;
    }
  }

  // stock — optional, nullable (null = unlimited), non-negative integer
  if (body.stock !== undefined) {
    if (body.stock === null || body.stock === '') {
      fields.stock = null;
    } else {
      const num = Number(body.stock);
      if (!Number.isFinite(num) || num < 0) {
        return { error: 'stock must be a non-negative number (or null for unlimited)' };
      }
      fields.stock = Math.floor(num);
    }
  }

  // is_active — optional bool
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return { error: 'is_active must be a boolean' };
    }
    fields.is_active = body.is_active;
  }

  return { fields };
}
