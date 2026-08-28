/** Join class names, dropping anything falsy. Small enough not to need clsx. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
