import { supabase } from './supabase.js';
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export const adminSnapshot = (organizationId, platform = false) => rpc('core_admin_snapshot', { requested_organization_id: organizationId || null, platform });
export const inspectPermissions = (organizationId, membershipId, unitId) => rpc('core_inspect_permissions', { requested_organization_id: organizationId, membership_id: membershipId, unit_id: unitId || null });
export const adminMutate = (action, organizationId, payload) => rpc('core_admin_mutate', { action, requested_organization_id: organizationId || null, payload });
export async function inviteTenantUser(organizationId, email, role) {
  const { data, error } = await supabase.functions.invoke('tenant-user-invite', { body: { organization_id: organizationId, email, role } });
  if (error || data?.error) throw new Error(data?.error || error.message);
  return data;
}
