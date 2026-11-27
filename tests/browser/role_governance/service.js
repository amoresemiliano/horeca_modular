const capabilities=[{code:'org.users.view',description:'Ver usuarios',scope:'ORGANIZATION'},{code:'personnel.schedules.view',description:'Ver horarios',scope:'OPERATIONAL_UNIT'}];
let roles=[{id:'owner',code:'OWNER',name:'Owner',description:'Sistema',is_active:true,reserved:true,users_count:1,capabilities:['org.users.view']}];
let member={id:'member',display_name:'Usuario sintético',role_code:'OWNER',is_active:true,is_organization_wide:true};
export async function roleAdminSnapshot(){return {roles:structuredClone(roles),capabilities};}
export async function roleAdminCommand(action,id,payload){if(action==='create'||action==='clone'){const source=roles.find(r=>r.id===id);roles.push({id:payload.code,code:payload.code,name:payload.name,description:payload.description,is_active:true,reserved:false,users_count:0,capabilities:action==='clone'?source.capabilities:payload.capabilities});}if(action==='update')roles=roles.map(r=>r.id===id?{...r,...payload}:r);if(action==='deactivate')roles=roles.map(r=>r.id===id?{...r,is_active:false}:r);return {};}
export async function adminSnapshot(){return {organizations:[{id:'org',name:'Tenant sintético',is_active:true}],members:[member],roles:roles.filter(r=>r.is_active),capabilities,role_grants:[],overrides:[],scopes:[],units:[],entitlements:[],audit:[]};}
export async function adminReadSnapshot(_org,section){return section==='users'?[{...member,role_name:member.role_code,units:[]}]:section==='roles'?[{code:'MANAGER_READ_OPERATIONAL',name:'Gerente',description:'Consulta',capabilities:[capabilities[0]]}]:[];}
export async function adminMutate(action,_org,payload){if(action==='member.role')member={...member,role_code:payload.role};return {};}
export async function inspectPermissions(){return [];}
export async function inviteTenantUser(){throw new Error('Unexpected invitation');}
