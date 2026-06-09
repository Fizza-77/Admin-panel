/** Format stored `faq_schema` (jsonb) for the admin textarea. */
export function faqSchemaToInput(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/** Parse SEO-provided FAQ schema text for database storage (jsonb). */
export function parseFaqSchemaInput(raw: unknown): unknown | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'object') {
    return raw;
  }

  if (typeof raw !== 'string') {
    throw new Error('FAQ schema must be valid JSON');
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error('FAQ schema must be valid JSON');
  }
}
