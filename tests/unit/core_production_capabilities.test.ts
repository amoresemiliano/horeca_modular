import { describe, it, expect } from 'vitest';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { DEFAULT_ROLE_CAPABILITIES, RoleTemplate } from '../../src/domain/tenancy/authorization/roles';
import { can, type AuthorizationEvaluationContext } from '../../src/domain/tenancy/authorization/evaluator';
import { ScopeType } from '../../src/domain/tenancy/authorization/scopes';
import { navigationAllowed } from '../../src/application/tenancy/accessNavigation';

const matrix = {
  [Capability.PRODUCTION_VIEW]: ['OWNER','MANAGER','PRODUCTION','COOK_COST_SHEET_MANAGER','CONSULTANT'],
  [Capability.PRODUCTION_PLAN_MANAGE]: ['OWNER','MANAGER','COOK_COST_SHEET_MANAGER'],
  [Capability.PRODUCTION_BATCH_CONFIRM]: ['OWNER','MANAGER'],
  [Capability.PRODUCTION_BATCH_CORRECT]: ['OWNER','MANAGER'],
  [Capability.PRODUCTION_WASTE_CONFIRM]: ['OWNER','MANAGER'],
};
const context: AuthorizationEvaluationContext = {
  user: { id:'synthetic',email:'synthetic@example.invalid',isActive:true },
  requiredCapability: Capability.PRODUCTION_BATCH_CONFIRM, organizationId:'lab',
  moduleEntitlement:{moduleKey:'produccion',isEnabled:true},
  targetScope:{scopeType:ScopeType.OPERATIONAL_UNIT,operationalUnitId:'kitchen'},
  membership:{organizationId:'lab',roleTemplate:RoleTemplate.OWNER,isActive:true,operationalUnitScopes:['kitchen']},
};
describe('Core approved Production capability alignment',()=>{
  it.each(Object.entries(matrix))('grants %s to exactly the approved role templates',(capability,roles)=>{
    const granted=Object.entries(DEFAULT_ROLE_CAPABILITIES).filter(([,caps])=>caps.includes(capability as Capability)).map(([role])=>role).sort();
    expect(granted).toEqual([...roles].sort());
  });
  it('allows read-only consultant navigation without logging or confirmation',()=>{
    const caps=DEFAULT_ROLE_CAPABILITIES.CONSULTANT;
    expect(navigationAllowed('Producción',(code:Capability)=>caps.includes(code),(key:string)=>key==='produccion')).toBe(true);
    expect(caps).not.toContain(Capability.PRODUCTION_BATCH_LOG);
    expect(caps).not.toContain(Capability.PRODUCTION_BATCH_CONFIRM);
    expect(navigationAllowed('Producción',(code:string)=>code==='production.view',()=>false)).toBe(false);
  });
  it('separates operator logging from batch and waste confirmation',()=>{
    const membership={...context.membership!,roleTemplate:RoleTemplate.PRODUCTION};
    for(const requiredCapability of [Capability.PRODUCTION_BATCH_LOG,Capability.PRODUCTION_WASTE_LOG])
      expect(can({...context,membership,requiredCapability}).allowed).toBe(true);
    for(const requiredCapability of [Capability.PRODUCTION_BATCH_CONFIRM,Capability.PRODUCTION_BATCH_CORRECT,Capability.PRODUCTION_WASTE_CONFIRM])
      expect(can({...context,membership,requiredCapability}).allowed).toBe(false);
  });
  it('requires explicit Production entitlement and selected unit',()=>{
    expect(can(context).allowed).toBe(true);
    for(const override of [{moduleEntitlement:undefined},{moduleEntitlement:{moduleKey:'ventas',isEnabled:true}},{moduleEntitlement:{moduleKey:'produccion',isEnabled:false}},{targetScope:undefined},{targetScope:{scopeType:ScopeType.ORGANIZATION}}])
      expect(can({...context,...override}).allowed).toBe(false);
  });
  it('denies empty/wrong unit scopes, inactive and foreign memberships and platform-only access',()=>{
    for(const override of [{operationalUnitScopes:[]},{operationalUnitScopes:['other']},{isActive:false},{organizationId:'foreign'}])
      expect(can({...context,membership:{...context.membership!,...override}}).allowed).toBe(false);
    expect(can({...context,isPlatformAdmin:true,membership:undefined}).allowed).toBe(false);
    expect(can({...context,membership:{...context.membership!,isOrganizationWide:true,operationalUnitScopes:[]}}).allowed).toBe(true);
  });
  it('explicit revoke wins over both role and grant',()=>{
    expect(can({...context,membership:{...context.membership!,capabilityOverrides:{granted:[Capability.PRODUCTION_BATCH_CONFIRM],revoked:[Capability.PRODUCTION_BATCH_CONFIRM]}}}).allowed).toBe(false);
  });
});
