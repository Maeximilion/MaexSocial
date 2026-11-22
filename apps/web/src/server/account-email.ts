export function normalizeAccountEmail(value: string): string | undefined {
  if (typeof value !== 'string' || value.length > 320 || /[^\x00-\x7f]/.test(value)) return undefined;
  const normalized = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').toLowerCase();
  const parts = normalized.split('@'), local = parts[0]!, domain = parts[1];
  if (normalized.length > 254 || parts.length !== 2 || !domain || local.length > 64
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return undefined;
  return normalized;
}
