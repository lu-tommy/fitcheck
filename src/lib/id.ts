/**
 * Ids are generated client-side because there is no server assigning them.
 * `crypto.randomUUID` needs a secure context, which localhost and https both
 * are; the fallback keeps a plain-http LAN preview working.
 */
export function createId(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}
