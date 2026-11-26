const org={id:'synthetic-org',name:'Organización sintética',is_active:true};
export async function adminSnapshot(){return {organizations:[org],audit:Array.from({length:45},(_,i)=>({id:'audit-'+i,action:'member.active',actor:'synthetic-actor',actor_name:'Administrador',target_name:'Usuario de prueba',created_at:'2026-01-01T10:00:00Z',change:{active:true}})),members:[],roles:[],capabilities:[],units:[],scopes:[],entitlements:[],overrides:[],role_grants:[]};}
export async function adminMutate(){throw new Error('Synthetic fixture is read-only');}
export async function inviteTenantUser(){throw new Error('Synthetic fixture is read-only');}
export async function inspectPermissions(){return [];}
