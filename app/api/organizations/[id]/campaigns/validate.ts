const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

interface ValidatedFields {
  fields: {
    slug?: string;
    title?: string;
    description?: string | null;
    goal_amount?: number | null;
    cause_type?: string | null;
    icon?: string | null;
    is_active?: boolean;
  };
}

export function validateCampaignBody(
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

  // slug — required on create, optional on update
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

  // goal_amount — optional, nullable, integer cents (≥0)
  if (body.goal_amount !== undefined) {
    if (body.goal_amount === null || body.goal_amount === '') {
      fields.goal_amount = null;
    } else {
      const num = Number(body.goal_amount);
      if (!Number.isFinite(num) || num < 0) {
        return { error: 'goal_amount must be a non-negative number of cents (or null)' };
      }
      fields.goal_amount = Math.floor(num);
    }
  }

  // cause_type — optional, nullable free-text tag
  if (body.cause_type !== undefined) {
    if (body.cause_type === null || body.cause_type === '') {
      fields.cause_type = null;
    } else if (typeof body.cause_type !== 'string') {
      return { error: 'cause_type must be a string or null' };
    } else {
      const trimmed = body.cause_type.trim();
      if (trimmed.length > 50) {
        return { error: 'cause_type must be at most 50 characters' };
      }
      fields.cause_type = trimmed;
    }
  }

  // icon — optional, nullable string (Tabler icon key)
  if (body.icon !== undefined) {
    if (body.icon === null || body.icon === '') {
      fields.icon = null;
    } else if (typeof body.icon !== 'string') {
      return { error: 'icon must be a string or null' };
    } else {
      const trimmed = body.icon.trim();
      if (trimmed.length > 60) {
        return { error: 'icon must be at most 60 characters' };
      }
      fields.icon = trimmed;
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
