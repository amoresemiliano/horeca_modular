// Selection does not grant access. An invalid explicit selection must stay empty.
export function selectOrganization(organizations, requestedId, previousId) {
  const id = requestedId || previousId || (organizations.length === 1 ? organizations[0].id : null);
  return organizations.find((organization) => organization.id === id) || null;
}

export function moduleEnabled(organizationId, entitlements, moduleKey) {
  return Boolean(organizationId) && typeof moduleKey === 'string'
    && entitlements.some((entry) => entry.module_key === moduleKey && entry.is_enabled === true);
}

export async function resolveAuthorizedCapabilities(client, organizationId, candidates, unitId = null) {
  const decisions = await Promise.all([...new Set(candidates)].map(async (code) => {
    const { data, error } = await client.rpc('can_execute_capability_for_org', {
      requested_organization_id: organizationId,
      required_capability_code: code,
      requested_operational_unit_id: unitId,
    });
    if (error) throw error;
    return data === true ? code : null;
  }));
  return decisions.filter(Boolean);
}
