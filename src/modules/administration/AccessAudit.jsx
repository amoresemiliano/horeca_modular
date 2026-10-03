import { ACCESS_PRESETS } from '../../application/tenancy/accessNavigation';
import { TENANT_FIELDS } from './TenantDetailsForm';
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
  return <section className="space-y-3"><h3 className="font-semibold">Auditoría de accesos</h3><p>Últimos 100 cambios administrativos.</p>
    {!data.audit.length&&<p>No hay cambios registrados.</p>}
    {data.audit.map(a=><article key={a.id} className="border rounded p-3 space-y-1">
      <strong>{actions[a.action]||'Cambio administrativo'}</strong><p>{auditSummary(a,data)}</p>
      <p>Actor: {a.actor_name||'Administrador registrado'} · Tenant: {tenant.name} · Usuario: {a.target_name||'No aplica'}</p>
      <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleString('es-ES')}</time>
      <details className="text-xs text-gray-500"><summary>Identificadores de auditoría</summary><p>Acción: {a.action} · Actor: {a.actor} · Registro: {a.id}</p></details>
    </article>)}
  </section>;
}
