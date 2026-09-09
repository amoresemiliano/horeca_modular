import { describe, it, expect } from 'vitest';
import { can } from '../../src/domain/tenancy/authorization/evaluator';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { RoleTemplate } from '../../src/domain/tenancy/authorization/roles';
import { ScopeType } from '../../src/domain/tenancy/authorization/scopes';
import { UserIdentity } from '../../src/domain/auth/types';

describe('Tenant Isolation & Security Acceptance Contract (Scope L)', () => {
  const userA: UserIdentity = { id: 'usr-a', email: 'userA@criollo.es', isActive: true };
  const userB: UserIdentity = { id: 'usr-b', email: 'userB@other.es', isActive: true };
  const userMulti: UserIdentity = { id: 'usr-multi', email: 'multi@group.es', isActive: true };
  const userInactive: UserIdentity = { id: 'usr-inactive', email: 'inactive@criollo.es', isActive: false };
  const platformAdmin: UserIdentity = { id: 'usr-platform-admin', email: 'admin@vegen.es', isActive: true };

  // Case 1: User A / Org A cannot read Org B
  it('Case 1: User A in Org A cannot read Org B data', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-b', // Attempting to read Org B
      membership: {
        organizationId: 'org-a', // User only holds membership in Org A
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('does not match evaluation target');
  });

  // Case 2: User A / Org A cannot write Org B
  it('Case 2: User A in Org A cannot write Org B data', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.STATEMENTS_IMPORT_UPLOAD,
      organizationId: 'org-b', // Attempting to write to Org B
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });
    expect(decision.allowed).toBe(false);
  });

  // Case 3: User with memberships A+B can explicitly access A, can explicitly access B
  it('Case 3: User with dual memberships (A+B) can access both when scoped correctly', () => {
    const decisionA = can({
      user: userMulti,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });
    expect(decisionA.allowed).toBe(true);

    const decisionB = can({
      user: userMulti,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-b',
      membership: {
        organizationId: 'org-b',
        roleTemplate: RoleTemplate.MANAGER,
        isActive: true,
      },
    });
    expect(decisionB.allowed).toBe(true);
  });

  // Case 4: ActiveContext tampering does not grant access
  it('Case 4: ActiveContext tampering without valid membership fails closed', () => {
    const decision = can({
      user: userB,
      requiredCapability: Capability.INVENTORY_STOCK_VIEW,
      organizationId: 'org-a', // Spoofed target organization
      membership: undefined, // No membership in Org A
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('missing or inactive');
  });

  // Case 5: Removed membership denied
  it('Case 5: Removed / missing membership is denied', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      membership: undefined,
    });
    expect(decision.allowed).toBe(false);
  });

  // Case 6: Inactive membership / user denied
  it('Case 6: Inactive user or inactive membership is denied fail-closed', () => {
    // 6a. Inactive membership
    const inactiveMemDecision = can({
      user: userA,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.OWNER,
        isActive: false, // Inactive membership
      },
    });
    expect(inactiveMemDecision.allowed).toBe(false);
    expect(inactiveMemDecision.reason).toContain('missing or inactive');

    // 6b. Inactive user identity
    const inactiveUserDecision = can({
      user: userInactive,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });
    expect(inactiveUserDecision.allowed).toBe(false);
    expect(inactiveUserDecision.reason).toContain('missing, invalid, or inactive');
  });

  // Case 7: Missing capability denied
  it('Case 7: Member lacking specific required capability is denied', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.SENSITIVEDATA_SALARIES_READ, // Highly sensitive
      organizationId: 'org-a',
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.RECEPTION_FLOOR, // Reception staff
        isActive: true,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('lacks required capability');
  });

  // Case 8: Missing OperationalUnit scope denied
  it('Case 8: Member scoped to Store 1 cannot access Store 2 data', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      targetScope: {
        scopeType: ScopeType.OPERATIONAL_UNIT,
        operationalUnitId: 'store-2',
      },
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.MANAGER,
        operationalUnitScopes: ['store-1'], // Only Store 1
        isActive: true,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('does not include operational unit');
  });

  // Case 9: Disabled module entitlement denied
  it('Case 9: Requesting operation for disabled module entitlement is denied', () => {
    const decision = can({
      user: userA,
      requiredCapability: Capability.COSTSHEETS_EDIT,
      organizationId: 'org-a',
      moduleEntitlement: {
        moduleKey: 'escandallos',
        isEnabled: false, // Module disabled for this org
      },
      membership: {
        organizationId: 'org-a',
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('not entitled/enabled');
  });

  // Case 10: Platform admin does not automatically gain tenant business-data access
  it('Case 10: Platform Admin control does not grant routine tenant business-data access without explicit membership', () => {
    // 10a. Platform op is permitted
    const platformOpDecision = can({
      user: platformAdmin,
      requiredCapability: Capability.PLATFORM_SYSTEM_MONITOR,
      organizationId: 'global',
      isPlatformAdmin: true,
    });
    expect(platformOpDecision.allowed).toBe(true);

    // 10b. Routine tenant business data is rejected
    const tenantDataDecision = can({
      user: platformAdmin,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-a',
      isPlatformAdmin: true,
      membership: undefined, // No tenant membership
    });
    expect(tenantDataDecision.allowed).toBe(false);
    expect(tenantDataDecision.reason).toContain('Platform control does not grant routine tenant operational data access');
  });
});
