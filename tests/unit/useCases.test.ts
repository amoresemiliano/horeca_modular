import { describe, it, expect, vi } from 'vitest';
import { GetActiveUserContextUseCase } from '../../src/application/tenancy/useCases/GetActiveUserContextUseCase';
import { ValidateActiveContextUseCase } from '../../src/application/tenancy/useCases/ValidateActiveContextUseCase';
import { IOrganizationMembershipRepository, UserOrganizationContext } from '../../src/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { RoleTemplate } from '../../src/domain/tenancy/authorization/roles';
import { Result } from '../../src/shared/errors/Result';
import { AppErrorCode } from '../../src/shared/errors/AppError';

describe('Tenancy & ActiveContext Use Cases (Scope C & Scope K)', () => {
  const mockOrgA: UserOrganizationContext = {
    organization: {
      id: 'org-cif-a',
      legalName: 'Taquería El Criollo S.L.',
      taxId: 'B-12345678',
      country: 'ES',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    membership: {
      id: 'mem-1',
      userId: 'usr-1',
      organizationId: 'org-cif-a',
      roleTemplate: RoleTemplate.OWNER,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  const mockOrgB: UserOrganizationContext = {
    organization: {
      id: 'org-cif-b',
      legalName: 'Obrador Central S.L.',
      taxId: 'B-87654321',
      country: 'ES',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    membership: {
      id: 'mem-2',
      userId: 'usr-1',
      organizationId: 'org-cif-b',
      roleTemplate: RoleTemplate.MANAGER,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  };

  const mockRepo: IOrganizationMembershipRepository = {
    findByUserId: vi.fn(),
    findPrimaryByUserId: vi.fn(),
    findOrganizationsByUserId: vi.fn(),
    findOperationalUnitsByOrgId: vi.fn(),
    findModuleEntitlementsByOrgId: vi.fn(),
    findUserOrganizations: vi.fn().mockResolvedValue(Result.ok([mockOrgA, mockOrgB])),
    findMembership: vi.fn().mockImplementation((_userId: string, orgId: string) => {
      if (orgId === 'org-cif-a') return Promise.resolve(Result.ok(mockOrgA.membership));
      if (orgId === 'org-cif-b') return Promise.resolve(Result.ok(mockOrgB.membership));
      return Promise.resolve(Result.ok(null));
    }),
    getActiveContext: vi.fn().mockResolvedValue(Result.ok('org-cif-a')),
    setActiveContext: vi.fn().mockResolvedValue(Result.ok(undefined)),
  };

  it('GetActiveUserContextUseCase resolves active context and available memberships', async () => {
    const useCase = new GetActiveUserContextUseCase(mockRepo);
    const result = await useCase.execute('usr-1');

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.activeOrganizationId).toBe('org-cif-a');
      expect(result.value.legalName).toBe('Taquería El Criollo S.L.');
      expect(result.value.availableOrganizations.length).toBe(2);
    }
  });

  it('GetActiveUserContextUseCase fails closed when user attempts to access unassigned organization', async () => {
    const useCase = new GetActiveUserContextUseCase(mockRepo);
    const result = await useCase.execute('usr-1', 'org-unauthorized-xyz');

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.error.code).toBe(AppErrorCode.AUTHORIZATION);
      expect(result.error.message).toContain('Access denied');
    }
  });

  it('ValidateActiveContextUseCase rejects unauthorized organization requests fail-closed', async () => {
    const useCase = new ValidateActiveContextUseCase(mockRepo);
    const result = await useCase.execute('usr-1', 'org-unauthorized-xyz');

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.error.code).toBe(AppErrorCode.AUTHORIZATION);
    }
  });

  it('ValidateActiveContextUseCase validates valid active membership', async () => {
    const useCase = new ValidateActiveContextUseCase(mockRepo);
    const result = await useCase.execute('usr-1', 'org-cif-b');

    expect(Result.isOk(result)).toBe(true);
    if (Result.isOk(result)) {
      expect(result.value.roleTemplate).toBe(RoleTemplate.MANAGER);
      expect(result.value.organizationId).toBe('org-cif-b');
    }
  });
});
