import { useEffect, useState } from 'react';
import { adminReadSnapshot } from '../../lib/tenantAdminService';
import { permissionGroup } from '../../application/tenancy/accessNavigation';

const titles = { users: 'Usuarios', roles: 'Roles y permisos', audit: 'Auditoría' };
const actions = { 'tenant.create':'Tenant creado', 'tenant.update':'Información actualizada', 'tenant.active':'Estado del tenant', 'entitlement.set':'Disponibilidad de módulo', 'member.role':'Rol actualizado', 'member.preset':'Perfil aplicado', 'member.override':'Permiso actualizado', 'member.scope':'Alcance actualizado', 'member.active':'Estado de membresía', 'user.invitation.requested':'Invitación solicitada', 'user.invitation.completed':'Usuario incorporado' };

export default function AdminReadView({ organizationId, section }) {
  const [rows, setRows] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setRows(null); setError('');
    adminReadSnapshot(organizationId, section).then(data => { if (current) setRows(data); }).catch(() => { if (current) setError('No se pudo consultar esta sección.'); });
    return () => { current = false; };
  }, [organizationId, section]);
  return <section className="space-y-4"><h2 className="text-xl font-semibold">{titles[section]}</h2>
    {error && <p role="alert">{error}</p>}{!rows && !error && <p role="status">Cargando…</p>}
    {rows?.length === 0 && <p>No hay registros.</p>}
    {section === 'users' && rows?.map(user => <article className="rounded border p-3" key={user.id}><h3 className="font-semibold">{user.display_name || 'Usuario'}</h3><p>{user.role_name || 'Sin rol'} · {user.is_active ? 'Activo' : 'Inactivo'}</p><p>Alcance: {user.is_organization_wide ? 'Toda la organización' : user.units.join(', ') || 'Sin unidades asignadas'}</p></article>)}
    {section === 'roles' && rows?.map(role => <article className="rounded border p-3" key={role.code}><h3 className="font-semibold">{role.name}</h3><p>{role.description}</p>{[...new Set(role.capabilities.map(c => permissionGroup(c.code)))].map(group => <details key={group}><summary>{group}</summary><ul>{role.capabilities.filter(c => permissionGroup(c.code) === group).map(c => <li key={c.code}>{c.description || 'Permiso'} <details><summary>Código técnico</summary>{c.code}</details></li>)}</ul></details>)}</article>)}
    {section === 'audit' && rows?.map(row => <article className="rounded border p-3" key={row.id}><p>{actions[row.action] || 'Cambio administrativo'} · <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('es-ES')}</time></p><p>Usuario: {row.target_name || 'No aplica'} · Actor: {row.actor_name || 'Administrador registrado'}</p></article>)}
  </section>;
}
