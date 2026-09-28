import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capability } from '../../src/domain/tenancy/authorization/capabilities';
import { RoleTemplate, DEFAULT_ROLE_CAPABILITIES } from '../../src/domain/tenancy/authorization/roles';
import { can, AuthorizationEvaluationContext } from '../../src/domain/tenancy/authorization/evaluator';
import { CanExecuteCapabilityUseCase } from '../../src/application/tenancy/useCases/CanExecuteCapabilityUseCase';
import { IOrganizationMembershipRepository } from '../../src/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Membership } from '../../src/domain/tenancy/entities/Membership';
import { Result } from '../../src/shared/errors/Result';
import { AppError } from '../../src/shared/errors/AppError';

const gate = Capability.STATEMENTS_IMPORT_CONFIRM;
function context(role: RoleTemplate = 'OWNER'): AuthorizationEvaluationContext {
  return {
    user: { id: 'HORECA_TEST_USER', email: 'horeca-security-confirm@test.invalid', isActive: true },
    requiredCapability: gate, organizationId: 'HORECA_TEST_ORG_A',
    moduleEntitlement: { moduleKey: 'bancos', isEnabled: true },
    membership: { organizationId: 'HORECA_TEST_ORG_A', roleTemplate: role, isActive: true, isOrganizationWide: true },
  };
}
describe('CCR-FIN-001 application policy (not database enforcement)', () => {
  it('uses the same exact canonical code as SQL without an alias capability', () => {
    expect(gate).toBe('STATEMENTS_IMPORT_CONFIRM');
    expect(Object.values(Capability).filter(code => code === gate)).toHaveLength(1);
  });
  it.each(Object.values(RoleTemplate))('limits default confirmation to the three approved roles: %s', role => {
    const expected = ['OWNER', 'MANAGER', 'ADMINISTRATIVE'].includes(role);
    expect(DEFAULT_ROLE_CAPABILITIES[role].includes(gate)).toBe(expected);
    expect(can(context(role)).allowed).toBe(expected);
  });
  it('explicit revoke wins over a default grant and an explicit grant', () => {
    const ctx = context();
    expect(can({ ...ctx, membership: { ...ctx.membership!, capabilityOverrides: { granted: [gate], revoked: [gate] } } }).allowed).toBe(false);
  });
  it('a platform administrator without tenant membership is denied', () => {
    expect(can({ ...context(), membership: undefined, isPlatformAdmin: true }).allowed).toBe(false);
  });
  it('rejects cross-organization and inactive membership', () => {
    const ctx = context();
    expect(can({ ...ctx, organizationId: 'HORECA_TEST_ORG_B' }).allowed).toBe(false);
    expect(can({ ...ctx, membership: { ...ctx.membership!, isActive: false } }).allowed).toBe(false);
  });
  it('rejects absent, disabled or unrelated entitlements and restricted scope', () => {
    const ctx = context();
    expect(can({ ...ctx, moduleEntitlement: undefined }).allowed).toBe(false);
    expect(can({ ...ctx, moduleEntitlement: { moduleKey: 'bancos', isEnabled: false } }).allowed).toBe(false);
    expect(can({ ...ctx, moduleEntitlement: { moduleKey: 'sales', isEnabled: true } }).allowed).toBe(false);
    expect(can({ ...ctx, membership: { ...ctx.membership!, isOrganizationWide: false } }).allowed).toBe(false);
  });
  it.each([Capability.STATEMENTS_IMPORT_UPLOAD, Capability.STATEMENTS_IMPORT_PROCESS, Capability.FINANCIAL_RECONCILIATION_REVIEW, Capability.FINANCIAL_RECONCILIATION_CONFIRM])('%s does not imply confirmation', capability => {
    const ctx = context('CONSULTANT');
    expect(can({ ...ctx, membership: { ...ctx.membership!, capabilityOverrides: { granted: [capability] } } }).allowed).toBe(false);
  });
});

describe('CCR-FIN-001 membership use case (mocked repository)', () => {
  let repository: IOrganizationMembershipRepository;
  let membership: Membership;
  let useCase: CanExecuteCapabilityUseCase;
  const input = { userId: 'HORECA_TEST_USER', organizationId: 'HORECA_TEST_ORG_B', capabilityCode: gate };
  beforeEach(() => {
    membership = { id: 'HORECA_TEST_MEMBER', userId: input.userId, organizationId: input.organizationId, role: 'OWNER',
      roleTemplateCode: 'OWNER', isActive: true, isOrganizationWide: true, capabilities: [gate], overrides: [] };
    repository = {
      findByUserId: vi.fn(async () => Result.ok([{ ...membership, id: 'first', organizationId: 'HORECA_TEST_ORG_A', capabilities: [] }, membership])),
      findPrimaryByUserId: vi.fn(), findOrganizationsByUserId: vi.fn(), findOperationalUnitsByOrgId: vi.fn(),
      findUserOrganizations: vi.fn(), findMembership: vi.fn(), getActiveContext: vi.fn(), setActiveContext: vi.fn(),
      findModuleEntitlementsByOrgId: vi.fn(async () => Result.ok([{ id: 'ent', organizationId: input.organizationId, moduleKey: 'bancos', isEnabled: true, planTier: 'test' }])),
    };
    useCase = new CanExecuteCapabilityUseCase(repository);
  });
  async function decision() {
    const result = await useCase.execute(input);
    expect(result.success).toBe(true);
    return result.success && result.value;
  }
  it('uses the requested organization without primary membership or ActiveContext fallback', async () => {
    expect(await decision()).toBe(true);
    expect(repository.findPrimaryByUserId).not.toHaveBeenCalled();
    expect(repository.getActiveContext).not.toHaveBeenCalled();
  });
  it('denies when entitlement lookup fails', async () => {
    vi.mocked(repository.findModuleEntitlementsByOrgId).mockResolvedValue(Result.fail(AppError.validation('test failure')));
    expect(await decision()).toBe(false);
  });
  it('denies when Finance entitlement is absent', async () => {
    vi.mocked(repository.findModuleEntitlementsByOrgId).mockResolvedValue(Result.ok([]));
    expect(await decision()).toBe(false);
  });
  it('a unit grant cannot defeat an organization revoke', async () => {
    membership.overrides = [{ capabilityCode: gate, effect: 'GRANT', operationalUnitId: 'unit' }, { capabilityCode: gate, effect: 'REVOKE' }];
    expect(await decision()).toBe(false);
  });
  it('unit-only membership cannot confirm an organization resource', async () => {
    membership.isOrganizationWide = false;
    expect(await decision()).toBe(false);
  });
});
