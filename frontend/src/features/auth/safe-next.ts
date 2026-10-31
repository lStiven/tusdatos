/** Only same-app paths: `?next=//evil.com` or `?next=https://…` would be an open redirect. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}
