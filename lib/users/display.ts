export function userDisplayLabel(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim();
  if (name) {
    return name;
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
): string {
  const name = displayName?.trim();
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
