import { describe, it, expect } from 'vitest';
import { can } from '../../src/domain/tenancy/authorization/evaluator';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { RoleTemplate } from '../../src/domain/tenancy/authorization/roles';
import { ScopeType } from '../../src/domain/tenancy/authorization/scopes';

describe('Canonical Authorization Evaluator (Scope K)', () => {
  const activeUser = {
    id: 'usr-1',
    email: 'test@criollo.es',
    isActive: true,
  };

  it('defaults to DENY when user has no active membership', () => {
    const decision = can({
      user: activeUser,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-1',
      membership: undefined,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('missing or inactive');
  });

  it('authorizes OWNER role template for standard management capabilities', () => {
    const decision = can({
      user: activeUser,
      requiredCapability: Capability.FINANCIAL_RECONCILIATION_CONFIRM,
      organizationId: 'org-1',
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.OWNER,
        isActive: true,
      },
    });

    expect(decision.allowed).toBe(true);
  });

  it('strictly isolates EXTERNAL_ACCOUNTANT to read/review without execution authority', () => {
    // Reviewing reconciliation is allowed for accountant
    const reviewDecision = can({
      user: activeUser,
      requiredCapability: Capability.FINANCIAL_RECONCILIATION_REVIEW,
      organizationId: 'org-1',
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.EXTERNAL_ACCOUNTANT,
        isActive: true,
      },
    });
    expect(reviewDecision.allowed).toBe(true);

    // Confirming reconciliation is DENIED for accountant
    const confirmDecision = can({
      user: activeUser,
      requiredCapability: Capability.FINANCIAL_RECONCILIATION_CONFIRM,
      organizationId: 'org-1',
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.EXTERNAL_ACCOUNTANT,
        isActive: true,
      },
    });
    expect(confirmDecision.allowed).toBe(false);
    expect(confirmDecision.reason).toContain('lacks required capability');
  });

  it('respects granted capability overrides over default role templates', () => {
    const decision = can({
      user: activeUser,
      requiredCapability: Capability.COSTSHEETS_EDIT,
      organizationId: 'org-1',
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.PRODUCTION, // Production lacks costsheets.edit by default
        capabilityOverrides: {
          granted: [Capability.COSTSHEETS_EDIT],
        },
        isActive: true,
      },
    });

    expect(decision.allowed).toBe(true);
  });

  it('respects revoked capability overrides', () => {
    const decision = can({
      user: activeUser,
      requiredCapability: Capability.PURCHASES_ORDER_APPROVE,
      organizationId: 'org-1',
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.MANAGER, // Manager has approve by default
        capabilityOverrides: {
          revoked: [Capability.PURCHASES_ORDER_APPROVE],
        },
        isActive: true,
      },
    });

    expect(decision.allowed).toBe(false);
  });

  it('enforces OperationalUnit scope boundary', () => {
    const allowedDecision = can({
      user: activeUser,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-1',
      targetScope: {
        scopeType: ScopeType.OPERATIONAL_UNIT,
        operationalUnitId: 'unit-store-a',
      },
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.MANAGER,
        operationalUnitScopes: ['unit-store-a', 'unit-store-b'],
        isActive: true,
      },
    });
    expect(allowedDecision.allowed).toBe(true);

    const deniedDecision = can({
      user: activeUser,
      requiredCapability: Capability.SALES_VIEW,
      organizationId: 'org-1',
      targetScope: {
        scopeType: ScopeType.OPERATIONAL_UNIT,
        operationalUnitId: 'unit-store-c',
      },
      membership: {
        organizationId: 'org-1',
        roleTemplate: RoleTemplate.MANAGER,
        operationalUnitScopes: ['unit-store-a', 'unit-store-b'],
        isActive: true,
      },
    });
    expect(deniedDecision.allowed).toBe(false);
    expect(deniedDecision.reason).toContain('does not include operational unit');
  });
});
