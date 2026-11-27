import { useEffect, useState } from 'react';
import { roleAdminSnapshot, roleAdminCommand } from '../../lib/tenantAdminService';
import { permissionGroup } from '../../application/tenancy/accessNavigation';

const labels = { 'org.config.read':'Ver configuración', 'org.users.view':'Ver usuarios', 'org.roles.view':'Ver roles y permisos', 'org.audit.view':'Ver auditoría', 'membership.users.invite':'Invitar usuarios', 'membership.roles.assign':'Asignar roles', 'membership.users.remove':'Quitar usuarios', 'personnel.employees.view':'Ver empleados', 'personnel.attendance.view':'Ver asistencia', 'personnel.schedules.view':'Ver horarios', 'personnel.schedules.manage':'Gestionar horarios', 'personnel.employees.manage':'Gestionar empleados', 'personnel.fichajes.audit':'Corregir fichajes', 'sensitivedata.banking.read':'Consultar datos bancarios', 'sales.view':'Ver ventas', 'catalog.products.read':'Ver productos', 'recipes.view':'Ver recetas', 'costsheets.view':'Ver escandallos', 'inventory.stock.view':'Ver inventario', 'reporting.operational.view':'Ver informes operativos' };
function kind(code) {
 if (/\.view$|\.read$/.test(code)) return 'Consulta';
 if (/\.create$|\.upload$/.test(code)) return 'Crear';
 if (/\.approve$|\.confirm$/.test(code)) return 'Aprobar';
 if (/\.delete|\.purge/.test(code)) return 'Eliminar';
 if (/\.manage$|\.assign|\.remove|\.invite|\.write|\.edit/.test(code)) return 'Gestión';
 return 'Operación';
}
const input='border rounded p-2 bg-white';
export default function RoleGovernance() {
 const [data,setData]=useState(null),[edit,setEdit]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function load(){setData(await roleAdminSnapshot());}
 useEffect(()=>{let active=true;roleAdminSnapshot().then(v=>{if(active)setData(v)}).catch(()=>{if(active)setError('No se pudieron cargar los roles.');});return()=>{active=false}},[]);
 async function run(action,id,payload){setBusy(true);setError('');try{await roleAdminCommand(action,id,payload);setEdit(null);await load();setNotice('Cambios guardados.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const fresh=()=>({mode:'create',code:'',name:'',description:'',capabilities:[]});
 const groups=[...new Set((data?.capabilities||[]).map(c=>permissionGroup(c.code)))];
 return <section className="space-y-4 max-w-5xl"><header className="flex flex-wrap gap-3 justify-between"><div><h2 className="text-xl font-semibold">Roles y permisos</h2><p className="text-sm">Plantillas reutilizables para organizaciones.</p></div><button className={input} disabled={busy} onClick={()=>{setNotice('');setEdit(fresh())}}>Nuevo rol</button></header>
 {error&&<p role="alert" className="text-red-700">{error}</p>}{notice&&<p role="status">{notice}</p>}{!data&&<p>Cargando roles…</p>}
 {!edit&&data?.roles.map(role=><article className="rounded border p-3 flex flex-wrap gap-3 justify-between" key={role.id}><div><h3 className="font-semibold">{role.name}</h3><p className="text-sm">{role.description||'Sin descripción'}</p><p className="text-xs">{role.is_active?'Activo':'Inactivo'} · {role.reserved?'Sistema':'Personalizado'} · {role.users_count} usuarios activos · {role.capabilities.length} permisos</p></div><div className="flex gap-2 items-start"><button className={input} onClick={()=>setEdit({...role,mode:'view'})}>Abrir</button>{role.is_active&&<button className={input} onClick={()=>setEdit({mode:'clone',source:role.id,code:'',name:'',description:role.description,capabilities:role.capabilities})}>Clonar</button>}{role.is_active&&!role.reserved&&<button className={input} disabled={busy} onClick={()=>{const warning=role.users_count ? `Este rol tiene ${role.users_count} usuarios activos que perderán el acceso efectivo. ¿Desactivar?` : '¿Desactivar este rol?';if(window.confirm(warning))run('deactivate',role.id,{confirm_assigned:role.users_count>0,expected_users:role.users_count});}}>Desactivar</button>}</div></article>)}
 {edit&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();run(edit.mode,edit.mode==='clone'?edit.source:edit.id,{code:edit.code,name:edit.name,description:edit.description,capabilities:edit.capabilities});}}>
  <h3 className="font-semibold">{edit.mode==='create'?'Nuevo rol':edit.mode==='clone'?'Clonar rol':edit.name}</h3>
  {edit.mode==='view'&&<p>{edit.is_active?'Activo':'Inactivo'} · {edit.reserved?'Sistema':'Personalizado'}</p>}
  <div className="grid sm:grid-cols-2 gap-3"><label>Nombre<input className={'block w-full '+input} required maxLength={120} disabled={edit.mode==='view'} value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></label><label>Código<input className={'block w-full '+input} required pattern="[A-Za-z][A-Za-z0-9_]{2,79}" disabled={!['create','clone'].includes(edit.mode)} value={edit.code} onChange={e=>setEdit({...edit,code:e.target.value.toUpperCase()})}/></label></div>
  <label>Descripción<textarea className={'block w-full '+input} maxLength={1000} disabled={edit.mode==='view'||edit.mode==='clone'} value={edit.description||''} onChange={e=>setEdit({...edit,description:e.target.value})}/></label>
  {edit.mode==='clone'&&<p>Se copiarán los permisos activos compatibles con organización.</p>}
  {edit.mode!=='clone'&&<div className="space-y-2">{groups.map(group=><details key={group} className="border rounded p-2"><summary className="font-semibold">{group}</summary><div className="grid sm:grid-cols-2 gap-2 mt-2">{data.capabilities.filter(c=>permissionGroup(c.code)===group).map(c=><div key={c.code} className="border-b p-1"><label className="flex gap-2 items-center"><input type="checkbox" disabled={edit.mode==='view'} checked={edit.capabilities.includes(c.code)} onChange={e=>setEdit({...edit,capabilities:e.target.checked?[...edit.capabilities,c.code]:edit.capabilities.filter(x=>x!==c.code)})}/><span>{labels[c.code]||c.description||'Permiso'} <small className="rounded bg-slate-100 px-1">{kind(c.code)}</small></span></label><details className="text-xs text-gray-500 ml-6"><summary>Detalles técnicos</summary>{c.code}</details></div>)}</div></details>)}</div>}
  <div className="flex gap-2"><button type="button" className={input} onClick={()=>setEdit(null)}>Volver</button>{edit.mode==='view'&&!edit.reserved&&edit.is_active&&<button type="button" className={input} onClick={()=>setEdit({...edit,mode:'update'})}>Editar</button>}{edit.mode!=='view'&&<button className={input} disabled={busy}>Guardar</button>}</div>
 </form>}
 </section>;
}
