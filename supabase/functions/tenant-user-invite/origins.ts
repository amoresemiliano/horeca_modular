export const trustedAppOrigins = [
  'https://horecamodular-git-dev-vegen-s-projects.vercel.app',
  'https://horecamodular.vercel.app',
] as const;

// The caller selects its environment through the exact browser Origin header.
// Missing origins and arbitrary redirect inputs never select a fallback.
export function invitationOrigin(origin: string | null): string | null {
  return trustedAppOrigins.some(trusted => trusted === origin) ? origin : null;
}
