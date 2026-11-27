export async function adminReadSnapshot(_org, section) { return ({ users: [{ id:'1', display_name:'Usuario sintético', role_name:'Gerente', is_active:true, is_organization_wide:true, units:[] }], roles:[{code:'READ',name:'Gerente',description:'Consulta',capabilities:[{code:'org.users.view',description:'Ver usuarios'}]}], audit:[{id:'1',action:'member.role',created_at:'2026-01-01T00:00:00Z',actor_name:'Administrador',target_name:'Usuario sintético'}] })[section]; }
export async function adminSnapshot() { throw new Error('Unexpected write-admin snapshot'); }
export async function adminMutate() { throw new Error('Unexpected mutation'); }
export async function inviteTenantUser() { throw new Error('Unexpected invitation'); }
export async function inspectPermissions() { throw new Error('Unexpected inspection'); }
