export function useAuth() {
 const manager = new URLSearchParams(location.search).has('manager');
 return {activeOrganization:{id:'org',name:'Tenant sintético'},organizationId:'org',can:code=>manager?['org.users.view','org.roles.view','org.audit.view'].includes(code):['membership.roles.assign','membership.users.invite','org.users.view'].includes(code),platformCan:()=>!manager};
}
