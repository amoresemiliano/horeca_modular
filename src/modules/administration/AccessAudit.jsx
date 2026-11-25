import { ACCESS_PRESETS } from '../../application/tenancy/accessNavigation';
import { TENANT_FIELDS } from './TenantDetailsForm';
import { useState } from 'react';
const actions = {'tenant.create':'Tenant creado','tenant.update':'Información actualizada','tenant.active':'Estado del tenant','entitlement.set':'Disponibilidad de módulo','member.role':'Rol base actualizado','member.preset':'Perfil aplicado','member.override':'Permiso actualizado','member.scope':'Alcance actualizado','member.active':'Estado de membresía','user.invitation.requested':'Invitación solicitada','user.invitation.completed':'Usuario incorporado','platform.bootstrap':'Administrador de plataforma asignado'};
export function auditSummary(event, data) {
  const change=event.change||{}, after=change.after||change;
  if(event.action==='tenant.update')return TENANT_FIELDS.filter(([key])=>change.before?.[key]!==after[key]).map(([,label])=>label).join(', ') || 'Información del tenant';
  if(event.action==='tenant.create')return after.name || 'Nuevo tenant';
  if(event.action==='member.preset')return ACCESS_PRESETS[after.preset]?.name || 'Perfil de acceso';
  if(event.action==='member.role')return data.roles.find(r=>r.code===after.role)?.name || 'Rol de la organización';
  if(event.action==='member.override')return `${data.capabilities.find(c=>c.code===after.capability)?.description || 'Permiso'}: ${{GRANT:'concedido',REVOKE:'denegado',INHERIT:'heredado'}[after.effect]||'actualizado'}`;
  if(event.action==='member.scope')return after.organization_wide?'Toda la organización':`${after.units?.length||0} unidades asignadas`;
  if(event.action==='member.active'||event.action==='tenant.active')return (after.active??after.is_active)?'Activo':'Inactivo';
  if(event.action==='entitlement.set')return `${after.module_key||after.module}: ${after.is_enabled?'habilitado':'deshabilitado'}`;
  return event.action.startsWith('user.invitation')?'Invitación segura de acceso':'Cambio administrativo';
}
export default function AccessAudit({ data, tenant }) {
  const [size,setSize]=useState(20),[page,setPage]=useState(1),[selected,setSelected]=useState(null);
  const pages=Math.max(1,Math.ceil(data.audit.length/size)), current=Math.min(page,pages);
  return <section className="space-y-3"><h3 className="font-semibold">Auditoría de accesos</h3><p className="text-xs">Últimos 100 cambios administrativos · {tenant.name}</p>
    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['Fecha','Acción','Resumen','Usuario','Actor',''].map((label,i)=><th key={i} className="p-2">{label}</th>)}</tr></thead><tbody>
    {data.audit.slice((current-1)*size,current*size).map(a=><tr key={a.id} className="border-t"><td className="p-2 whitespace-nowrap"><time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString('es-ES')}</time></td><td className="p-2">{actions[a.action]||'Cambio administrativo'}</td><td className="p-2">{auditSummary(a,data)}</td><td className="p-2">{a.target_name||'No aplica'}</td><td className="p-2">{a.actor_name||'Administrador registrado'}</td><td className="p-2"><button onClick={()=>setSelected(selected?.id===a.id?null:a)} className="underline">Detalles</button></td></tr>)}
    </tbody></table></div>
    {!data.audit.length&&<p>No hay cambios registrados.</p>}
    {selected&&<div role="region" aria-label="Detalles de auditoría" className="bg-gray-50 p-3 text-xs break-all">Acción: {selected.action} · Actor: {selected.actor} · Registro: {selected.id}</div>}
    <nav aria-label="Paginación de auditoría" className="flex flex-wrap items-center gap-3 text-xs"><label>Filas <select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[20,50,100].map(n=><option key={n}>{n}</option>)}</select></label><span>{data.audit.length} registros · Página {current} de {pages}</span><button disabled={current===1} onClick={()=>setPage(current-1)}>Anterior</button><button disabled={current===pages} onClick={()=>setPage(current+1)}>Siguiente</button></nav>
  </section>;
}
