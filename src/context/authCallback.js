// Server-created invitations have no browser-held PKCE verifier. Only the
// dedicated setup callback accepts implicit tokens; normal OAuth keeps PKCE.
export function authFlowForLocation(location) {
  if (!location || location.pathname !== '/reset-password') return 'pkce';
  const params = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return ['invite', 'recovery'].includes(params.get('type')) && params.has('access_token') ? 'implicit' : 'pkce';
}
