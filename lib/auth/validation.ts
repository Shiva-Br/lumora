// Client-side email shape check — enough to enable the submit button and give
// inline feedback. Supabase remains the authority on whether an address is
// deliverable.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test((value || '').trim());
}
