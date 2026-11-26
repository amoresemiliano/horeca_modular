import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { TENANT_ADMIN_CAPS } from '../../application/tenancy/accessNavigation';
import TenantAdministration from './TenantAdministration';

export default function ConfigurationHome() {
  const { can, platformCan, activeOrganization } = useAuth();
  const [selection, setSelection] = useState(null);
  const tenantAllowed = !!activeOrganization && TENANT_ADMIN_CAPS.some(code => can(code));
  const platformAllowed = platformCan('platform.tenants.provision');
  const cards = [
    ...(tenantAllowed ? [{label:'Organización', description:'Información y datos de la organización.', page:'general'}, {label:'Usuarios y accesos', description:'Membresías, perfiles y permisos.', page:'users'}] : []),
    ...(platformAllowed ? [{label:'Tenants', description:'Administración de organizaciones.', page:'tenants', platform:true}, {label:'Módulos', description:'Disponibilidad de módulos por organización.', page:'modules', platform:true}] : []),
    ...(tenantAllowed || platformAllowed ? [{label:'Auditoría', description:'Consulta los cambios administrativos.', page:'audit', platform:!tenantAllowed}] : []),
  ];
  if (selection) return <div className="space-y-3"><button className="text-sm text-emerald-800 underline" onClick={()=>setSelection(null)}>← Configuración</button><TenantAdministration platform={!!selection.platform} initialPage={selection.page}/></div>;
  return <section className="space-y-4"><p className="text-sm text-gray-600">Administra la organización y los accesos disponibles para tu perfil.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card=><button key={card.label} onClick={()=>setSelection(card)} className="rounded-lg border border-gray-200 p-4 text-left hover:border-emerald-600 focus-visible:outline-emerald-700"><strong className="block text-sm">{card.label}</strong><span className="block mt-1 text-xs text-gray-600">{card.description}</span><span className="block mt-3 text-xs font-semibold text-emerald-800">Abrir →</span></button>)}</div></section>;
}
