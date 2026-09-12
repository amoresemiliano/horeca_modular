import { describe, it, expect, vi } from 'vitest';
import { GetAccessibleOrganizationsUseCase } from '@/application/tenancy/useCases/GetAccessibleOrganizationsUseCase';
import { GetAccessibleOperationalUnitsUseCase } from '@/application/tenancy/useCases/GetAccessibleOperationalUnitsUseCase';
import { ResolveEffectiveCapabilitiesUseCase } from '@/application/tenancy/useCases/ResolveEffectiveCapabilitiesUseCase';
import { SwitchActiveOrganizationUseCase } from '@/application/tenancy/useCases/SwitchActiveOrganizationUseCase';
import { SwitchActiveOperationalUnitUseCase } from '@/application/tenancy/useCases/SwitchActiveOperationalUnitUseCase';
import { CanExecuteCapabilityUseCase } from '@/application/tenancy/useCases/CanExecuteCapabilityUseCase';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Result } from '@/shared/errors/Result';

describe('Tenancy & Capability Authorization Use Cases', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const orgAId = '22222222-2222-2222-2222-222222222222';
  const orgBId = '33333333-3333-3333-3333-333333333333';
  const unit1Id = '44444444-4444-4444-4444-444444444444';

  const mockRepo: IOrganizationMembershipRepository = {
    findByUserId: vi.fn(),
    findPrimaryByUserId: vi.fn(),
    findOrganizationsByUserId: vi.fn(),
    findOperationalUnitsByOrgId: vi.fn(),
    findModuleEntitlementsByOrgId: vi.fn(),
    findUserOrganizations: vi.fn(),
    findMembership: vi.fn(),
    getActiveContext: vi.fn(),
    setActiveContext: vi.fn(),
  };

  it('GetAccessibleOrganizationsUseCase returns organizations for valid user', async () => {
    vi.mocked(mockRepo.findOrganizationsByUserId).mockResolvedValueOnce(
      Result.ok([
        { id: orgAId, name: 'Org A', legalName: 'Org A SL', taxId: 'B12345678', countryCode: 'ES', isActive: true },
        { id: orgBId, name: 'Org B', legalName: 'Org B SL', taxId: 'B87654321', countryCode: 'ES', isActive: true },
      ])
    );

    const useCase = new GetAccessibleOrganizationsUseCase(mockRepo);
    const result = await useCase.execute(userId);

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe(orgAId);
    }
  });

  it('GetAccessibleOperationalUnitsUseCase rejects access if user has no membership', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(Result.ok([]));

    const useCase = new GetAccessibleOperationalUnitsUseCase(mockRepo);
    const result = await useCase.execute(userId, orgAId);

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.error.code).toBe('AUTHORIZATION');
    }
  });

  it('ResolveEffectiveCapabilitiesUseCase resolves role capabilities and applies overrides', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
      Result.ok([
        {
          id: 'mem-1',
          organizationId: orgAId,
          userId,
          role: 'ADMINISTRATIVE',
          roleTemplateCode: 'ADMINISTRATIVE',
          capabilities: ['BANK_IMPORT', 'REPORT_VIEW', 'RECORD_VIEW'],
          overrides: [
            { capabilityCode: 'ORG_SETTINGS_MANAGE', effect: 'GRANT' },
            { capabilityCode: 'BANK_IMPORT', effect: 'REVOKE' },
          ],
          isActive: true,
        },
      ])
    );

    const useCase = new ResolveEffectiveCapabilitiesUseCase(mockRepo);
    const result = await useCase.execute(userId, orgAId);

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value).toContain('REPORT_VIEW');
      expect(result.value).toContain('RECORD_VIEW');
      expect(result.value).toContain('ORG_SETTINGS_MANAGE');
      expect(result.value).not.toContain('BANK_IMPORT'); // Revoked
    }
  });

  it('SwitchActiveOrganizationUseCase validates target organization membership', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
      Result.ok([
        {
          id: 'mem-1',
          organizationId: orgAId,
          userId,
          role: 'OWNER',
          roleTemplateCode: 'OWNER',
          isActive: true,
        },
      ])
    );

    const useCase = new SwitchActiveOrganizationUseCase(mockRepo);
    const validResult = await useCase.execute({ userId, targetOrganizationId: orgAId });
    expect(Result.isOk(validResult)).toBe(true);

    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
      Result.ok([
        {
          id: 'mem-1',
          organizationId: orgAId,
          userId,
          role: 'OWNER',
          roleTemplateCode: 'OWNER',
          isActive: true,
        },
      ])
    );

    const invalidResult = await useCase.execute({ userId, targetOrganizationId: orgBId });
    expect(Result.isFailure(invalidResult)).toBe(true);
    if (Result.isFailure(invalidResult)) {
      expect(invalidResult.error.code).toBe('AUTHORIZATION');
    }
  });

  it('SwitchActiveOperationalUnitUseCase validates unit exists in tenant', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
      Result.ok([{ id: 'mem-1', organizationId: orgAId, userId, role: 'OWNER', isActive: true }])
    );
    vi.mocked(mockRepo.findOperationalUnitsByOrgId).mockResolvedValueOnce(
      Result.ok([{ id: unit1Id, organizationId: orgAId, code: 'KITCHEN_1', name: 'Cocina', unitType: 'KITCHEN', isActive: true }])
    );

    const useCase = new SwitchActiveOperationalUnitUseCase(mockRepo);
    const result = await useCase.execute({ userId, organizationId: orgAId, targetOperationalUnitId: unit1Id });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.activeOperationalUnitId).toBe(unit1Id);
    }
  });

  it('CanExecuteCapabilityUseCase enforces fail-closed default DENY', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(Result.ok([]));

    const useCase = new CanExecuteCapabilityUseCase(mockRepo);
    const result = await useCase.execute({
      userId,
      organizationId: orgAId,
      capabilityCode: 'BANK_IMPORT',
    });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value).toBe(false); // DENY
    }
  });

  it('CanExecuteCapabilityUseCase respects module entitlement disabled state', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
      Result.ok([
        {
          id: 'mem-1',
          organizationId: orgAId,
          userId,
          role: 'OWNER',
          roleTemplateCode: 'OWNER',
          capabilities: ['BANK_IMPORT', 'RECORD_VIEW'],
          isActive: true,
        },
      ])
    );
    vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(
      Result.ok([
        { id: 'ent-1', organizationId: orgAId, moduleKey: 'bank', isEnabled: false, planTier: 'basic' },
      ])
    );

    const useCase = new CanExecuteCapabilityUseCase(mockRepo);
    const result = await useCase.execute({
      userId,
      organizationId: orgAId,
      capabilityCode: 'BANK_IMPORT',
    });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value).toBe(false); // DENIED due to entitlement
    }
  });
});
