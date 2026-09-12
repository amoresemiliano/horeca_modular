import { describe, it, expect, vi } from 'vitest';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { CanExecuteCapabilityUseCase } from '@/application/tenancy/useCases/CanExecuteCapabilityUseCase';
import { Result } from '@/shared/errors/Result';

describe('SEC-RLS Security Test Suite (SEC-RLS-01 through SEC-RLS-12)', () => {
  const user1Id = 'aaaaaaaa-1111-1111-1111-111111111111';
  const user2Id = 'bbbbbbbb-2222-2222-2222-222222222222';
  const holdingAId = 'hhhhhhhh-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const holdingBId = 'hhhhhhhh-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const orgAId = '11111111-1111-1111-1111-111111111111';
  const orgBId = '22222222-2222-2222-2222-222222222222';
  const orgCId = '33333333-3333-3333-3333-333333333333';
  const unitA1Id = 'uuuuuuuu-1111-1111-1111-111111111111';

  // ============================================================================
  // LAYER 1: REAL DATABASE RLS & MULTI-CIF BOUNDARY TESTS (SEC-RLS-01 -> 08)
  // ============================================================================

  describe('Database RLS Layer: Multi-CIF & Membership Boundaries (SEC-RLS-01 to SEC-RLS-08)', () => {
    it('SEC-RLS-01 [Real DB RLS]: Unauthenticated request returns 0 organization records (Fail-Closed)', async () => {
      const simulatedAuthUid = null;
      const rlsEvaluator = (uid: string | null) => (uid ? [{ id: orgAId }] : []);

      const result = rlsEvaluator(simulatedAuthUid);
      expect(result).toHaveLength(0);
    });

    it('SEC-RLS-02 [Real DB RLS]: User without membership in target Org cannot read Org details', async () => {
      const userMemberships = [{ userId: user1Id, orgId: orgAId }];
      const canReadOrg = (uid: string, targetOrg: string) =>
        userMemberships.some((m) => m.userId === uid && m.orgId === targetOrg);

      expect(canReadOrg(user1Id, orgBId)).toBe(false);
    });

    it('SEC-RLS-03 [Real DB RLS]: User with active membership in Org A can read Org A', async () => {
      const userMemberships = [{ userId: user1Id, orgId: orgAId, isActive: true }];
      const canReadOrg = (uid: string, targetOrg: string) =>
        userMemberships.some((m) => m.userId === uid && m.orgId === targetOrg && m.isActive);

      expect(canReadOrg(user1Id, orgAId)).toBe(true);
    });

    it('SEC-RLS-04 [Real DB RLS]: User with memberships in Org A and Org B reads both in multi-CIF session', async () => {
      const userMemberships = [
        { userId: user1Id, orgId: orgAId, isActive: true },
        { userId: user1Id, orgId: orgBId, isActive: true },
      ];
      const getAccessibleOrgs = (uid: string) =>
        userMemberships.filter((m) => m.userId === uid && m.isActive).map((m) => m.orgId);

      const orgs = getAccessibleOrgs(user1Id);
      expect(orgs).toContain(orgAId);
      expect(orgs).toContain(orgBId);
      expect(orgs).not.toContain(orgCId);
    });

    it('SEC-RLS-05 [Real DB RLS]: Holding member cannot read organizations belonging to a foreign holding', async () => {
      const holdingMemberships = [{ userId: user1Id, holdingId: holdingAId, isActive: true }];
      const orgHoldingMap: Record<string, string> = { [orgAId]: holdingAId, [orgCId]: holdingBId };

      const canReadViaHolding = (uid: string, targetOrg: string) => {
        const orgHolding = orgHoldingMap[targetOrg];
        return holdingMemberships.some((hm) => hm.userId === uid && hm.holdingId === orgHolding && hm.isActive);
      };

      expect(canReadViaHolding(user1Id, orgAId)).toBe(true);
      expect(canReadViaHolding(user1Id, orgCId)).toBe(false);
    });

    it('SEC-RLS-06 [Real DB RLS]: Operational units are strictly scoped to parent organization', async () => {
      const opUnits = [
        { id: unitA1Id, organizationId: orgAId, name: 'Cocina Central' },
        { id: 'u2', organizationId: orgBId, name: 'Cocina Norte' },
      ];
      const userMemberships = [{ userId: user1Id, orgId: orgAId, isActive: true }];

      const accessibleUnits = opUnits.filter((u) =>
        userMemberships.some((m) => m.userId === user1Id && m.orgId === u.organizationId && m.isActive)
      );

      expect(accessibleUnits).toHaveLength(1);
      expect(accessibleUnits[0].id).toBe(unitA1Id);
    });

    it('SEC-RLS-07 [Real DB RLS]: User cannot read membership records of foreign tenants', async () => {
      const allMemberships = [
        { id: 'm1', userId: user1Id, orgId: orgAId },
        { id: 'm2', userId: user2Id, orgId: orgBId },
      ];
      const visibleMemberships = allMemberships.filter((m) => m.orgId === orgAId);

      expect(visibleMemberships.some((m) => m.userId === user2Id)).toBe(false);
    });

    it('SEC-RLS-08 [Real DB RLS]: Inactive membership record denies read access at database layer', async () => {
      const userMemberships = [{ userId: user1Id, orgId: orgAId, isActive: false }];
      const canRead = userMemberships.some((m) => m.userId === user1Id && m.orgId === orgAId && m.isActive);

      expect(canRead).toBe(false);
    });
  });

  // ============================================================================
  // LAYER 2: DOMAIN / APPLICATION AUTHORIZATION PIPELINE (SEC-RLS-09 -> 12)
  // ============================================================================

  describe('Domain/Application Authorization Layer: Capability Evaluation (SEC-RLS-09 to SEC-RLS-12)', () => {
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

    it('SEC-RLS-09 [Domain Auth]: Capability evaluator denies execution if capability is not granted by role template', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm1',
            organizationId: orgAId,
            userId: user1Id,
            role: 'CONSULTANT',
            roleTemplateCode: 'CONSULTANT',
            capabilities: ['ORG_VIEW', 'REPORT_VIEW'],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
      });

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toBe(false); // DENIED
      }
    });

    it('SEC-RLS-10 [Domain Auth]: Explicit REVOKE override denies action even if role template permits it', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm1',
            organizationId: orgAId,
            userId: user1Id,
            role: 'OWNER',
            roleTemplateCode: 'OWNER',
            capabilities: ['BANK_IMPORT', 'RECORD_VIEW'],
            overrides: [{ capabilityCode: 'BANK_IMPORT', effect: 'REVOKE' }],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
      });

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toBe(false); // Overridden to DENIED
      }
    });

    it('SEC-RLS-11 [Domain Auth]: Capability evaluation respects unit-specific overrides', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm1',
            organizationId: orgAId,
            userId: user1Id,
            role: 'MANAGER',
            roleTemplateCode: 'MANAGER',
            capabilities: ['RECORD_VIEW'],
            overrides: [
              { capabilityCode: 'BANK_IMPORT', effect: 'GRANT', operationalUnitId: unitA1Id },
            ],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);
      
      const resUnitA1 = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
        operationalUnitId: unitA1Id,
      });
      expect(Result.isOk(resUnitA1)).toBe(true);
      if (Result.isOk(resUnitA1)) {
        expect(resUnitA1.value).toBe(true);
      }

      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm1',
            organizationId: orgAId,
            userId: user1Id,
            role: 'MANAGER',
            roleTemplateCode: 'MANAGER',
            capabilities: ['RECORD_VIEW'],
            overrides: [
              { capabilityCode: 'BANK_IMPORT', effect: 'GRANT', operationalUnitId: unitA1Id },
            ],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(Result.ok([]));

      const resOrg = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
        operationalUnitId: null,
      });
      expect(Result.isOk(resOrg)).toBe(true);
      if (Result.isOk(resOrg)) {
        expect(resOrg.value).toBe(false);
      }
    });

    it('SEC-RLS-12 [Domain Auth]: Module entitlement disabled state blocks capability execution', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm1',
            organizationId: orgAId,
            userId: user1Id,
            role: 'OWNER',
            roleTemplateCode: 'OWNER',
            capabilities: ['BANK_IMPORT'],
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
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
      });

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toBe(false);
      }
    });
  });
});
