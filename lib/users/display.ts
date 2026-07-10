export function userDisplayLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
  surname?: string | null | undefined,
): string {
  const first = displayName?.trim();
  const last = surname?.trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) {
    return combined;
  }
  const mail = email?.trim();
  if (mail) {
    return mail.split('@')[0] ?? mail;
  }
  return 'User';
}

export function userInitials(
  displayName: string | null | undefined,
  email: string | null | undefined,
  surname?: string | null | undefined,
): string {
  const first = displayName?.trim();
  const last = surname?.trim();
  if (first && last) {
    return (first[0] + last[0]).toUpperCase().slice(0, 2);
  }
  const name = first || last;
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }
  const mail = email?.trim();
  if (mail) {
    return mail.slice(0, 2).toUpperCase();
  }
  return 'U';
}
