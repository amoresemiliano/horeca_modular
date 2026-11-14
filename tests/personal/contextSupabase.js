// Isolated browser fixture. Never imported by production entries.
const org={id:'10000000-0000-4000-8000-000000000001',name:'Synthetic tenant',code:'SYNTHETIC',is_active:true};
const unit={id:'20000000-0000-4000-8000-000000000001',name:'Synthetic unit'};
const user={id:'30000000-0000-4000-8000-000000000001',email:'synthetic@example.invalid'};
const caps=['personnel.employees.manage','personnel.fichajes.audit','personnel.fichajes.write'];
const session=()=>sessionStorage.getItem('signed-out')?null:{user,access_token:'synthetic-only'};
let callback=()=>{};
window.addEventListener('fixture-refresh',()=>callback('SIGNED_IN',session()));
export const supabase={
 auth:{getSession:async()=>({data:{session:session()}}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{sessionStorage.setItem('signed-out','true');callback('SIGNED_OUT',null);return {}; }},
 rpc:async(name,params)=>({data:name==='core_platform_can'?sessionStorage.getItem('fixture-platform')==='true':name==='core_admin_snapshot'?{organizations:[org],members:[],units:[unit],profiles:[],role_templates:[],capabilities:[],role_grants:[],overrides:[],scopes:[],entitlements:[],module_availability:[],audit:[]}:name==='can_execute_capability_for_org'?caps.includes(params.required_capability_code):null,error:null}),
 from(table){let single=false;const builder={select(){return this;},eq(){return this;},or(){return this;},maybeSingle(){single=true;return this;},then(resolve){let data=[];
 if(table==='eco_user_profiles')data={id:user.id};
 if(table==='eco_organization_members')data=sessionStorage.getItem('revoke-tenant')?[]:[{id:'membership',organization_id:org.id,role:'HR_PERSONNEL',role_template_id:'role',eco_organizations:org}];
 if(table==='eco_role_template_capabilities')data=caps.map(code=>({eco_capabilities:{code}}));
 if(table==='eco_organization_module_entitlements')data=[{module_key:'personal',is_enabled:!sessionStorage.getItem('revoke-module')}];
 if(table==='eco_operational_units')data=sessionStorage.getItem('revoke-unit')?[]:[unit];
 return Promise.resolve({data:single?data:data,error:null}).then(resolve);}};return builder;}
};
