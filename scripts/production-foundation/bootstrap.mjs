// Offline compiler only. No credentials, network, database connection or apply mode.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const ATTENDANCE_CAPABILITIES = Object.freeze(['personnel.employees.manage', 'personnel.fichajes.write', 'personnel.fichajes.audit']);
export const MODULE_KEYS = Object.freeze(['bancos','ventas','compras','inventario','produccion','escandallos','personal','reporting','prediccion','documentos','integraciones']);
const staging = 'vmxjqwlfwnphorthhcwu';
const quote = value => `'${String(value).replace(/'/g, "''")}'`;
// Match canonical Git text on Windows (autocrlf) and Linux without changing SQL.
export const canonicalMigrationText = text => text.replace(/\r\n/g,'\n');
function shape(value, keys, label) {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`Invalid ${label} fields (no credentials accepted)`);
}
export function validateConfig(config) {
  shape(config,['environment','projectRef','origin','organization','unit','identities'],'configuration');
  if (config.environment !== 'production' || !/^[a-z]{20}$/.test(config.projectRef || '') || config.projectRef === staging) throw new Error('Independent production projectRef required');
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.origin !== config.origin || origin.hostname.includes('-git-') || origin.hostname.endsWith('-vegen-s-projects.vercel.app') || ['localhost','127.0.0.1'].includes(origin.hostname)) throw new Error('Canonical production HTTPS origin required');
  shape(config.organization,['code','name','timezone','countryCode','currency'],'organization');
  shape(config.unit,['code','name','type'],'unit');
  for (const value of [config.organization.code,config.organization.name,config.unit.code,config.unit.name]) if (typeof value !== 'string' || !value.trim() || value.length>200) throw new Error('Canonical organization/unit fields required');
  if (config.organization.countryCode !== 'ES' || config.organization.currency !== 'EUR' || config.organization.timezone !== 'Europe/Madrid' || config.unit.type !== 'LOCAL') throw new Error('Review customer country, currency, timezone and unit type');
  shape(config.identities,['platformAdmin','tenantOwner','personnelAdmin'],'identities');
  const identities=Object.values(config.identities);
  if (identities.length!==3) throw new Error('All three explicit identity bindings required');
  for (const identity of identities) {
    shape(identity,['authUserId','email'],'identity');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.authUserId || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email || '')) throw new Error('Verified production Auth user ID and email required; never use staging IDs');
  }
  const {platformAdmin:p,tenantOwner:o,personnelAdmin:h}=config.identities;
  if (h.authUserId===p.authUserId || h.authUserId===o.authUserId || h.email.toLowerCase()===p.email.toLowerCase() || h.email.toLowerCase()===o.email.toLowerCase()) throw new Error('Personnel administrator must be distinct from privileged owners');
  if ((p.authUserId===o.authUserId)!==(p.email.toLowerCase()===o.email.toLowerCase())) throw new Error('Identity bindings conflict');
  return config;
}

export function migrationBundle() {
  const manifest=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
  return manifest.map(({file,sha256})=>{
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(file)) throw new Error('Invalid reviewed migration path');
    const sql=canonicalMigrationText(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    if (createHash('sha256').update(sql).digest('hex')!==sha256) throw new Error('Reviewed migration checksum changed: '+file);
    return {file,sha256,sql};
  });
}

export function compileBootstrap(input) {
  const c=validateConfig(input),{platformAdmin:p,tenantOwner:o,personnelAdmin:h}=c.identities;
  const allowed=ATTENDANCE_CAPABILITIES.map(quote).join(','),modules=MODULE_KEYS.map(quote).join(',');
  const identities=[...new Map(Object.values(c.identities).map(i=>[i.authUserId,i])).values()];
  return `-- Reviewed offline production bootstrap. No Auth users or operational data created.
-- Target project: ${c.projectRef}. Require independent target verification before execution.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('horeca-production-foundation-v1'));
DO $bootstrap$
DECLARE org uuid; unit_id uuid; platform_profile uuid; owner_profile uuid; member uuid; ticket uuid; capability record; module text;
BEGIN
 IF current_setting('horeca.bootstrap_project_ref',true) IS DISTINCT FROM ${quote(c.projectRef)} THEN RAISE EXCEPTION 'Explicit verified production target required'; END IF;
 ${identities.map(i=>`IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=${quote(i.authUserId)}::uuid AND lower(email)=lower(${quote(i.email)}) AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified production Auth identity missing'; END IF;`).join('\n ')}
 IF EXISTS(SELECT 1 FROM public.eco_organizations WHERE code=${quote(c.organization.code)}) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.eco_organizations) OR EXISTS(SELECT 1 FROM public.personnel_employees) OR EXISTS(SELECT 1 FROM public.personnel_punch_devices) THEN RAISE EXCEPTION 'Initial bootstrap requires clean customer/runtime state'; END IF;
 ${identities.map(i=>`INSERT INTO public.eco_user_profiles(auth_user_id,display_name) VALUES(${quote(i.authUserId)}::uuid,${quote(i.email)}) ON CONFLICT(auth_user_id) DO NOTHING;`).join('\n ')}
 SELECT id INTO STRICT platform_profile FROM public.eco_user_profiles WHERE auth_user_id=${quote(p.authUserId)}::uuid AND is_active;
 SELECT id INTO STRICT owner_profile FROM public.eco_user_profiles WHERE auth_user_id=${quote(o.authUserId)}::uuid AND is_active;
 -- One-time trusted bootstrap bindings; never a public function or browser privilege.
 INSERT INTO public.eco_user_platform_role(user_profile_id,role_template_id)
 SELECT platform_profile,id FROM public.eco_role_templates WHERE code='VEGEN_PLATFORM_ADMIN' AND tier='PLATFORM' AND is_active ON CONFLICT(user_profile_id) DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',${quote(p.authUserId)},true);
 PERFORM set_config('request.jwt.claims',${quote(JSON.stringify({sub:p.authUserId,email:p.email}))},true);
 org:=(public.core_admin_mutate('tenant.create',NULL,${quote(JSON.stringify({code:c.organization.code,name:c.organization.name,timezone:c.organization.timezone,country_code:c.organization.countryCode,currency:c.organization.currency}))}::jsonb)->>'organization_id')::uuid;
 INSERT INTO public.eco_operational_units(organization_id,code,name,unit_type) VALUES(org,${quote(c.unit.code)},${quote(c.unit.name)},${quote(c.unit.type)}) RETURNING id INTO unit_id;
 INSERT INTO public.eco_organization_members(organization_id,user_id,role_template_id,role,is_organization_wide)
 SELECT org,owner_profile,id,'OWNER',true FROM public.eco_role_templates WHERE code='OWNER' AND tier='ORGANIZATION' AND is_active;
 FOREACH module IN ARRAY ARRAY[${modules}] LOOP
  PERFORM public.core_admin_mutate('entitlement.set',org,jsonb_build_object('module',module,'enabled',module='personal'));
 END LOOP;
 ticket:=public.core_prepare_invitation(org,${quote(h.email)},'HR_PERSONNEL');
 member:=public.core_complete_invitation(ticket,${quote(h.authUserId)}::uuid,${quote(h.email)});
 PERFORM set_config('request.jwt.claim.sub',${quote(o.authUserId)},true);
 FOR capability IN SELECT code FROM public.eco_capabilities WHERE scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND is_active LOOP
  PERFORM public.core_admin_mutate('member.override',org,jsonb_build_object('membership_id',member,'capability',capability.code,'effect',CASE WHEN capability.code IN(${allowed}) THEN 'GRANT' ELSE 'REVOKE' END));
 END LOOP;
 INSERT INTO public.eco_access_audit(actor,action,organization_id,change) VALUES(${quote(p.authUserId)}::uuid,'production.foundation.bootstrap',org,jsonb_build_object('version',1,'unit_id',unit_id,'explicit_owner_auth_user_id',${quote(o.authUserId)},'personnel_membership_id',member));
END; $bootstrap$;
${compileVerification(c)}
COMMIT;
`;
}

export function compileVerification(input) {
  const c=validateConfig(input),{platformAdmin:p,tenantOwner:o,personnelAdmin:h}=c.identities;
  const allowed=ATTENDANCE_CAPABILITIES.map(quote).join(',');
  return `DO $verify$
DECLARE org uuid; unit_id uuid; member uuid; capability record;
BEGIN
 SELECT id INTO STRICT org FROM public.eco_organizations WHERE code=${quote(c.organization.code)} AND name=${quote(c.organization.name)} AND timezone=${quote(c.organization.timezone)} AND is_active;
 SELECT id INTO STRICT unit_id FROM public.eco_operational_units WHERE organization_id=org AND code=${quote(c.unit.code)} AND name=${quote(c.unit.name)} AND is_active;
 IF NOT EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=org AND module_key='personal' AND is_enabled) OR EXISTS(SELECT 1 FROM public.eco_organization_module_entitlements WHERE organization_id=org AND module_key<>'personal' AND is_enabled) THEN RAISE EXCEPTION 'Personnel-only entitlement baseline required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eco_user_platform_role a JOIN public.eco_user_profiles p ON p.id=a.user_profile_id JOIN public.eco_role_templates r ON r.id=a.role_template_id WHERE p.auth_user_id=${quote(p.authUserId)}::uuid AND p.is_active AND a.is_active AND r.code='VEGEN_PLATFORM_ADMIN') THEN RAISE EXCEPTION 'Platform binding mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id JOIN public.eco_role_templates r ON r.id=m.role_template_id WHERE p.auth_user_id=${quote(o.authUserId)}::uuid AND m.organization_id=org AND m.is_active AND m.is_organization_wide AND p.is_active AND r.code='OWNER') THEN RAISE EXCEPTION 'Explicit tenant OWNER binding mismatch'; END IF;
 SELECT m.id INTO STRICT member FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id JOIN public.eco_role_templates r ON r.id=m.role_template_id WHERE p.auth_user_id=${quote(h.authUserId)}::uuid AND m.organization_id=org AND m.is_active AND m.is_organization_wide AND p.is_active AND r.code='HR_PERSONNEL';
 IF EXISTS(SELECT 1 FROM public.eco_user_platform_role a JOIN public.eco_user_profiles p ON p.id=a.user_profile_id WHERE p.auth_user_id=${quote(h.authUserId)}::uuid AND a.is_active) OR EXISTS(SELECT 1 FROM public.eco_organization_members m JOIN public.eco_user_profiles p ON p.id=m.user_id WHERE p.auth_user_id=${quote(h.authUserId)}::uuid AND m.organization_id<>org AND m.is_active) THEN RAISE EXCEPTION 'Personnel identity has foreign/platform authority'; END IF;
 PERFORM set_config('request.jwt.claim.sub',${quote(h.authUserId)},true);
 FOR capability IN SELECT id,code,scope FROM public.eco_capabilities WHERE scope IN('ORGANIZATION','OPERATIONAL_UNIT') AND is_active LOOP
  IF NOT EXISTS(SELECT 1 FROM public.eco_member_capability_overrides v WHERE v.membership_id=member AND v.capability_id=capability.id AND v.operational_unit_id IS NULL AND v.effect=CASE WHEN capability.code IN(${allowed}) THEN 'GRANT' ELSE 'REVOKE' END) THEN RAISE EXCEPTION 'Explicit attendance-only policy drift'; END IF;
  IF public.can_execute_capability_for_org(org,capability.code,CASE WHEN capability.scope='OPERATIONAL_UNIT' THEN unit_id ELSE NULL END) IS DISTINCT FROM (capability.code IN(${allowed})) THEN RAISE EXCEPTION 'Effective attendance-only access mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE t.relkind='r' AND (n.nspname='personnel_private' OR (n.nspname='public' AND t.relname LIKE 'personnel_%')) AND NOT t.relrowsecurity) THEN RAISE EXCEPTION 'Personnel RLS missing'; END IF;
END; $verify$;`;
}
