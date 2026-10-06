export const BANKS_SECTIONS = { Consolidado: 'banks.consolidated.view', Resumen: 'banks.summary.view', 'Gráficas': 'banks.metrics.view', 'Métricas': 'banks.metrics.view' };
export const MODULE_ACCESS = {
  Dashboard: ['reporting', 'reporting.operational.view'], Bancos: ['bancos', ...Object.values(BANKS_SECTIONS)],
  Ventas: ['ventas', 'sales.view', 'sales.tickets.read'], KPI: ['reporting', 'reporting.operational.view', 'reporting.pnl.view'],
  Inventario: ['inventario', 'inventory.stock.view', 'inventory.count.run'], Escandallos: ['escandallos', 'recipes.view', 'costsheets.view'],
  Compras: ['compras', 'purchases.order.create', 'purchases.invoices.manage'], 'Producción': ['produccion', 'production.batch.log', 'production.waste.log'],
  Personal: ['personal', 'personnel.employees.manage', 'personnel.fichajes.write'], 'Predicción': ['prediccion', 'reporting.operational.view'],
};
export const TENANT_ADMIN_CAPS = ['membership.users.invite', 'membership.roles.assign', 'membership.users.remove', 'org.config.write'];
export function navigationAllowed(module, can, enabled, platformCan = () => false) {
  if (module === 'PlatformAdmin') return platformCan('platform.tenants.provision');
  if (module === 'Config') return TENANT_ADMIN_CAPS.some(code => can(code));
  const [key, ...codes] = MODULE_ACCESS[module] || [];
  if (module === 'Bancos') return Boolean(enabled(key) && can('sensitivedata.banking.read') && codes.some(code => can(code)));
  return Boolean(key && enabled(key) && codes.some(code => can(code)));
}
// Discovery in platform context is separate from permission to execute a module.
export function visibleModules(keys, can, enabled, platformCan, scope) {
  const catalog = scope === 'platform' && platformCan('platform.tenants.provision');
  return keys.filter(key => (catalog && key in MODULE_ACCESS)
    || (key === 'Config' && platformCan('platform.tenants.provision'))
    || navigationAllowed(key, can, enabled, platformCan));
}
export function banksSectionAllowed(tab, can) { return Boolean(BANKS_SECTIONS[tab] && can(BANKS_SECTIONS[tab]) && can('sensitivedata.banking.read')); }

// UI/application presets, never authoritative roles. Revoke the base template's
// unrelated permissions so a Banks-only preset cannot inherit Sales/HR access.
export const BANKS_BASE = ['banks.consolidated.view', 'sensitivedata.banking.read'];
export const ACCESS_PRESETS = {
  BANKS_FULL: { name: 'Bancos · acceso completo', role: 'CONSULTANT', grants: [...BANKS_BASE, 'banks.summary.view', 'banks.metrics.view', 'banks.accounts.manage', 'banks.categories.manage', 'banks.counterparties.manage', 'banks.rules.manage', 'banks.transfers.review', 'statements.import.upload', 'statements.import.process', 'STATEMENTS_IMPORT_CONFIRM', 'financial.allocation.edit', 'financial.reconciliation.review', 'financial.reconciliation.confirm'] },
  BANKS_IMPORT: { name: 'Bancos · importación y Consolidado', role: 'CONSULTANT', grants: [...BANKS_BASE, 'statements.import.upload', 'statements.import.process', 'STATEMENTS_IMPORT_CONFIRM'] },
  BANKS_READ: { name: 'Bancos · solo lectura', role: 'CONSULTANT', grants: [...BANKS_BASE, 'banks.summary.view', 'banks.metrics.view'] },
  FINANCE_REVIEW: { name: 'Finanzas · revisión', role: 'CONSULTANT', grants: [...BANKS_BASE, 'banks.summary.view', 'banks.metrics.view', 'financial.allocation.edit', 'financial.reconciliation.review'] },
};
// Public UX names. Legacy keys remain accepted for existing callers and audit history.
Object.assign(ACCESS_PRESETS, {
  BANKS_VIEWER: { ...ACCESS_PRESETS.BANKS_READ, name: 'Bancos · consulta', description: 'Consolidado, Resumen y Métricas. Sin importaciones ni cambios.' },
  BANKS_IMPORT_OPERATOR: { ...ACCESS_PRESETS.BANKS_IMPORT, name: 'Bancos · importación', description: 'Solo Consolidado e importación. Sin clasificación ni configuración.' },
  BANKS_RECONCILIATION_OPERATOR: { ...ACCESS_PRESETS.FINANCE_REVIEW, name: 'Bancos · conciliación', description: 'Vistas, clasificación y revisión/confirmación de conciliación. Sin administración del tenant.', grants: [...ACCESS_PRESETS.FINANCE_REVIEW.grants, 'financial.reconciliation.confirm'] },
  BANKS_ADMIN: { ...ACCESS_PRESETS.BANKS_FULL, name: 'Bancos · administración completa', description: 'Todas las secciones y acciones de Bancos. Sin otros módulos.' },
});
export const VISIBLE_PRESETS = ['BANKS_VIEWER', 'BANKS_IMPORT_OPERATOR', 'BANKS_RECONCILIATION_OPERATOR', 'BANKS_ADMIN'];
export function presetOverrides(key, capabilities) {
  const preset = ACCESS_PRESETS[key];
  if (!preset) throw new Error('Perfil de acceso desconocido');
  return capabilities.map(c => ({ capability: c.code, effect: preset.grants.includes(c.code) ? 'GRANT' : 'REVOKE' }));
}
export function permissionGroup(code) {
  if (code.startsWith('banks.') || code.startsWith('statements.') || code.startsWith('financial.') || code === 'STATEMENTS_IMPORT_CONFIRM' || code === 'sensitivedata.banking.read') return 'Bancos';
  if (/^(membership|org|opunit)\./.test(code)) return 'Administración de organización';
  return ({ sales: 'Ventas', purchases: 'Compras', suppliers: 'Compras', catalog: 'Catálogo', recipes: 'Escandallos', costsheets: 'Escandallos', inventory: 'Inventario', production: 'Producción', personnel: 'Personal', reporting: 'Informes', documents: 'Documentos', integrations: 'Integraciones', data: 'Datos', sensitivedata: 'Datos sensibles' })[code.split('.')[0]] || 'Otros';
}
// Display-only explanation; mutations and effective access remain server-authorized.
export function explainPermission(snapshot, member, capability, unitId = null) {
  const overrides = snapshot.overrides.filter(o => o.membership_id === member.id && o.capability_id === capability.id && (!o.operational_unit_id || o.operational_unit_id === unitId));
  if (!member.is_active) return 'Membresía inactiva';
  if (capability.scope === 'ORGANIZATION' && unitId) return 'Consulta este permiso en contexto de organización';
  if (capability.required_module_key && !snapshot.entitlements.some(e => e.module_key === capability.required_module_key && e.is_enabled)) return 'Módulo no habilitado';
  if (capability.scope === 'OPERATIONAL_UNIT' && !unitId) return 'Selecciona unidad';
  if (!member.is_organization_wide && (capability.scope !== 'OPERATIONAL_UNIT' || !snapshot.scopes.some(s => s.membership_id === member.id && s.operational_unit_id === unitId))) return 'Fuera de alcance';
  if (overrides.some(o => o.effect === 'REVOKE')) return 'Denegado explícitamente';
  if (overrides.some(o => o.effect === 'GRANT')) return 'Permitido por concesión';
  return snapshot.role_grants.some(g => g.role_template_id === member.role_template_id && g.capability_id === capability.id) ? 'Permitido por rol' : 'Sin permiso';
}
