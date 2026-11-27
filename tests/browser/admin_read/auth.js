export function useAuth() { return { activeOrganization: { id: 'synthetic' }, can: code => ['org.users.view', 'org.roles.view', 'org.audit.view'].includes(code), platformCan: () => false }; }
