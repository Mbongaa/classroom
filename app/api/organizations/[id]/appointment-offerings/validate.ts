const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidatedFields {
  fields: {
    slug?: string;
    sheikh_name?: string;
    sheikh_email?: string;
    sheikh_bio?: string | null;
    sheikh_avatar_url?: string | null;
    price?: number;
    duration_minutes?: number;
    location?: string | null;
    timezone?: string;
    is_active?: boolean;
  };
}

export function validateOfferingBody(
  body: Record<string, unknown>,
  { mode }: { mode: 'create' | 'update' },
): ValidatedFields | { error: string } {
  const fields: ValidatedFields['fields'] = {};

  // sheikh_name — required on create
  if (body.sheikh_name !== undefined) {
    if (typeof body.sheikh_name !== 'string') {
      return { error: 'sheikh_name must be a string' };
    }
    const trimmed = body.sheikh_name.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      return { error: 'sheikh_name must be 2-200 characters' };
    }
    fields.sheikh_name = trimmed;
  } else if (mode === 'create') {
    return { error: 'sheikh_name is required' };
  }

  // sheikh_email — required on create (used for booking notifications)
  if (body.sheikh_email !== undefined) {
    if (typeof body.sheikh_email !== 'string') {
      return { error: 'sheikh_email must be a string' };
    }
    const trimmed = body.sheikh_email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed) || trimmed.length > 320) {
      return { error: 'sheikh_email must be a valid email address' };
    }
    fields.sheikh_email = trimmed;
  } else if (mode === 'create') {
    return { error: 'sheikh_email is required' };
  }

  // slug — required on create, immutable after
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

  // sheikh_bio — optional, nullable
  if (body.sheikh_bio !== undefined) {
    if (body.sheikh_bio === null || body.sheikh_bio === '') {
      fields.sheikh_bio = null;
    } else if (typeof body.sheikh_bio !== 'string') {
      return { error: 'sheikh_bio must be a string or null' };
    } else {
      const trimmed = body.sheikh_bio.trim();
      if (trimmed.length > 5000) {
        return { error: 'sheikh_bio must be at most 5000 characters' };
      }
      fields.sheikh_bio = trimmed;
    }
  }

  // sheikh_avatar_url — optional, nullable
  if (body.sheikh_avatar_url !== undefined) {
    if (body.sheikh_avatar_url === null || body.sheikh_avatar_url === '') {
      fields.sheikh_avatar_url = null;
    } else if (typeof body.sheikh_avatar_url !== 'string') {
      return { error: 'sheikh_avatar_url must be a string or null' };
    } else {
      const trimmed = body.sheikh_avatar_url.trim();
      if (trimmed.length > 2000) {
        return { error: 'sheikh_avatar_url must be at most 2000 characters' };
      }
      fields.sheikh_avatar_url = trimmed;
    }
  }

  // price — required on create, cents (positive integer)
  if (body.price !== undefined) {
    const num = Number(body.price);
    if (!Number.isFinite(num) || num <= 0) {
      return { error: 'price must be a positive number of cents' };
    }
    fields.price = Math.floor(num);
  } else if (mode === 'create') {
    return { error: 'price is required' };
  }

  // duration_minutes — required on create, 1..480
  if (body.duration_minutes !== undefined) {
    const num = Number(body.duration_minutes);
    if (!Number.isFinite(num) || num <= 0 || num > 480) {
      return { error: 'duration_minutes must be between 1 and 480' };
    }
    fields.duration_minutes = Math.floor(num);
  } else if (mode === 'create') {
    return { error: 'duration_minutes is required' };
  }

  // location — optional, nullable free-text
  if (body.location !== undefined) {
    if (body.location === null || body.location === '') {
      fields.location = null;
    } else if (typeof body.location !== 'string') {
      return { error: 'location must be a string or null' };
    } else {
      const trimmed = body.location.trim();
      if (trimmed.length > 500) {
        return { error: 'location must be at most 500 characters' };
      }
      fields.location = trimmed;
    }
  }

  // timezone — optional IANA timezone
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string') {
      return { error: 'timezone must be a string' };
    }
    const trimmed = body.timezone.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      return { error: 'timezone must be a valid IANA timezone' };
    }
    fields.timezone = trimmed;
  }

  // is_active — optional
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return { error: 'is_active must be a boolean' };
    }
    fields.is_active = body.is_active;
  }

  return { fields };
}

// ---------------------------------------------------------------------------
// Availability rule validation
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export interface ValidatedRule {
  kind: 'weekly' | 'date_override';
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_blocking: boolean;
}

export function validateAvailabilityRules(
  rules: unknown,
): { rules: ValidatedRule[] } | { error: string } {
  if (!Array.isArray(rules)) {
    return { error: 'rules must be an array' };
  }
  if (rules.length > 200) {
    return { error: 'rules must not exceed 200 entries' };
  }

  const validated: ValidatedRule[] = [];
  for (const [i, raw] of rules.entries()) {
    if (!raw || typeof raw !== 'object') {
      return { error: `rules[${i}] must be an object` };
    }
    const rule = raw as Record<string, unknown>;

    const kind = rule.kind;
    if (kind !== 'weekly' && kind !== 'date_override') {
      return { error: `rules[${i}].kind must be "weekly" or "date_override"` };
    }

    const startTime = rule.start_time == null || rule.start_time === '' ? null : rule.start_time;
    const endTime = rule.end_time == null || rule.end_time === '' ? null : rule.end_time;
    if (startTime !== null && (typeof startTime !== 'string' || !TIME_RE.test(startTime))) {
      return { error: `rules[${i}].start_time must be HH:MM` };
    }
    if (endTime !== null && (typeof endTime !== 'string' || !TIME_RE.test(endTime))) {
      return { error: `rules[${i}].end_time must be HH:MM` };
    }
    if (startTime !== null && endTime !== null && String(startTime) >= String(endTime)) {
      return { error: `rules[${i}] start_time must be before end_time` };
    }

    if (kind === 'weekly') {
      const dow = Number(rule.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return { error: `rules[${i}].day_of_week must be 0-6 for weekly rules` };
      }
      if (startTime === null || endTime === null) {
        return { error: `rules[${i}] weekly rules require start_time and end_time` };
      }
      validated.push({
        kind: 'weekly',
        day_of_week: dow,
        specific_date: null,
        start_time: String(startTime),
        end_time: String(endTime),
        is_blocking: false,
      });
    } else {
      if (typeof rule.specific_date !== 'string' || !DATE_RE.test(rule.specific_date)) {
        return { error: `rules[${i}].specific_date must be YYYY-MM-DD` };
      }
      const isBlocking = rule.is_blocking === true;
      validated.push({
        kind: 'date_override',
        day_of_week: null,
        specific_date: rule.specific_date,
        start_time: startTime === null ? null : String(startTime),
        end_time: endTime === null ? null : String(endTime),
        is_blocking: isBlocking,
      });
    }
  }

  return { rules: validated };
}
