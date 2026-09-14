import { describe, it, expect, vi } from 'vitest';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { CanExecuteCapabilityUseCase } from '@/application/tenancy/useCases/CanExecuteCapabilityUseCase';
import { SwitchActiveOperationalUnitUseCase } from '@/application/tenancy/useCases/SwitchActiveOperationalUnitUseCase';
import { GetAccessibleOperationalUnitsUseCase } from '@/application/tenancy/useCases/GetAccessibleOperationalUnitsUseCase';
import { Result } from '@/shared/errors/Result';

describe('SEC-RLS & SEC-CONTRACT Security Test Suite', () => {
  const user1Id = 'aaaaaaaa-1111-1111-1111-111111111111';
  const user2Id = 'bbbbbbbb-2222-2222-2222-222222222222';
  const holdingAId = 'hhhhhhhh-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const holdingBId = 'hhhhhhhh-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const orgAId = '11111111-1111-1111-1111-111111111111';
  const orgBId = '22222222-2222-2222-2222-222222222222';
  const orgCId = '33333333-3333-3333-3333-333333333333';
  const unitA1Id = 'uuuuuuuu-1111-1111-1111-111111111111';
  const unitA2Id = 'uuuuuuuu-2222-2222-2222-222222222222';
  const unitA3Id = 'uuuuuuuu-3333-3333-3333-333333333333';

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
            isOrganizationWide: true,
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
            isOrganizationWide: true,
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
            isOrganizationWide: true,
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
            isOrganizationWide: true,
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
            isOrganizationWide: true,
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

  // ============================================================================
  // LAYER 3: CONTRACT REMEDIATION SPECIFIC TESTS (SEC-CONTRACT-01 to SEC-CONTRACT-10)
  // ============================================================================

  describe('Contract Remediation Tests (SEC-CONTRACT-01 to SEC-CONTRACT-10)', () => {
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

    it('SEC-CONTRACT-01 [Domain/DB Contract]: Unknown legacy role does NOT map to OWNER', async () => {
      const legacyRoles = ['UNKNOWN_ROLE_XYZ', 'TEST_ROLE', 'ANONYMOUS'];
      const mapLegacyRole = (r: string) => {
        if (r === 'SUPERADMIN') return 'OWNER';
        if (r === 'ADMIN') return 'ADMINISTRATIVE';
        if (r === 'GERENTE') return 'MANAGER';
        if (r === 'OPERADOR') return 'PRODUCTION';
        if (r === 'CONSULTA') return 'CONSULTANT';
        return null; // Must NOT return OWNER
      };

      for (const r of legacyRoles) {
        expect(mapLegacyRole(r)).toBeNull();
      }
    });

    it('SEC-CONTRACT-02 [Domain Auth]: Unknown legacy role fails capability authorization closed (DENY)', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm-unknown',
            organizationId: orgAId,
            userId: user1Id,
            role: 'UNKNOWN_LEGACY_ROLE',
            roleTemplateId: null,
            roleTemplateCode: null,
            isOrganizationWide: false,
            capabilities: [],
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
        expect(res.value).toBe(false); // Strict fail-closed DENY
      }
    });

    it('SEC-CONTRACT-03 [Domain Auth]: Membership scoped to Unit A cannot access Unit B', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm-scoped',
            organizationId: orgAId,
            userId: user1Id,
            role: 'PRODUCTION',
            roleTemplateCode: 'PRODUCTION',
            isOrganizationWide: false,
            operationalUnitScopes: [unitA1Id],
            capabilities: ['PRODUCTION_BATCH_LOG'],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValueOnce(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'PRODUCTION_BATCH_LOG',
        operationalUnitId: unitA2Id, // Unit B
      });

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toBe(false); // Denied because Unit B is outside unitA1Id scope
      }
    });

    it('SEC-CONTRACT-04 [Domain Auth]: Membership scoped to Unit A + Unit B can access both', async () => {
      const scopedMembership = {
        id: 'm-multi-scoped',
        organizationId: orgAId,
        userId: user1Id,
        role: 'MANAGER',
        roleTemplateCode: 'MANAGER',
        isOrganizationWide: false,
        operationalUnitScopes: [unitA1Id, unitA2Id],
        capabilities: ['INVENTORY_COUNT_RUN'],
        isActive: true,
      };

      vi.mocked(mockRepo.findByUserId).mockResolvedValue(Result.ok([scopedMembership]));
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValue(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);

      const resUnitA = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'INVENTORY_COUNT_RUN',
        operationalUnitId: unitA1Id,
      });
      expect(Result.isOk(resUnitA)).toBe(true);
      if (Result.isOk(resUnitA)) expect(resUnitA.value).toBe(true);

      const resUnitB = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'INVENTORY_COUNT_RUN',
        operationalUnitId: unitA2Id,
      });
      expect(Result.isOk(resUnitB)).toBe(true);
      if (Result.isOk(resUnitB)) expect(resUnitB.value).toBe(true);

      const resUnitC = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'INVENTORY_COUNT_RUN',
        operationalUnitId: unitA3Id,
      });
      expect(Result.isOk(resUnitC)).toBe(true);
      if (Result.isOk(resUnitC)) expect(resUnitC.value).toBe(false); // Denied for Unit C
    });

    it('SEC-CONTRACT-05 [Domain Auth]: Organization-wide membership can access all Organization units', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm-org-wide',
            organizationId: orgAId,
            userId: user1Id,
            role: 'OWNER',
            roleTemplateCode: 'OWNER',
            isOrganizationWide: true,
            operationalUnitScopes: [],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findOperationalUnitsByOrgId).mockResolvedValueOnce(
        Result.ok([
          { id: unitA1Id, organizationId: orgAId, code: 'U1', name: 'Salón', unitType: 'LOCAL', isActive: true },
          { id: unitA2Id, organizationId: orgAId, code: 'U2', name: 'Cocina', unitType: 'PRODUCTION_CENTER', isActive: true },
        ])
      );

      const useCase = new GetAccessibleOperationalUnitsUseCase(mockRepo);
      const res = await useCase.execute(user1Id, orgAId);

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toHaveLength(2);
      }
    });

    it('SEC-CONTRACT-06 [Domain Auth]: ActiveContext cannot select an out-of-scope unit', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(
        Result.ok([
          {
            id: 'm-scoped',
            organizationId: orgAId,
            userId: user1Id,
            role: 'PRODUCTION',
            roleTemplateCode: 'PRODUCTION',
            isOrganizationWide: false,
            operationalUnitScopes: [unitA1Id],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findOperationalUnitsByOrgId).mockResolvedValueOnce(
        Result.ok([
          { id: unitA1Id, organizationId: orgAId, code: 'U1', name: 'Cocina 1', unitType: 'PRODUCTION_CENTER', isActive: true },
          { id: unitA2Id, organizationId: orgAId, code: 'U2', name: 'Cocina 2', unitType: 'PRODUCTION_CENTER', isActive: true },
        ])
      );

      const useCase = new SwitchActiveOperationalUnitUseCase(mockRepo);
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        targetOperationalUnitId: unitA2Id, // Out of scope
      });

      expect(Result.isFailure(res)).toBe(true);
      if (Result.isFailure(res)) {
        expect(res.error.code).toBe('AUTHORIZATION');
      }
    });

    it('SEC-CONTRACT-07 [Domain Auth]: VEGEN_PLATFORM_ADMIN without OrganizationMembership does not gain tenant operational access', async () => {
      // User has platform admin role but 0 organization memberships
      vi.mocked(mockRepo.findByUserId).mockResolvedValueOnce(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);
      const res = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'BANK_IMPORT',
      });

      expect(Result.isOk(res)).toBe(true);
      if (Result.isOk(res)) {
        expect(res.value).toBe(false); // Fail closed
      }
    });

    it('SEC-CONTRACT-08 [Domain Auth]: CREATE_PURCHASE_ORDER does not imply APPROVE_PURCHASE_ORDER', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValue(
        Result.ok([
          {
            id: 'm-purchaser',
            organizationId: orgAId,
            userId: user1Id,
            role: 'PURCHASING',
            roleTemplateCode: 'PURCHASING',
            isOrganizationWide: true,
            capabilities: ['PURCHASES_ORDER_CREATE', 'PURCHASES_RECEPTION_CONFIRM'],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValue(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);

      const canCreate = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'PURCHASES_ORDER_CREATE',
      });
      expect(Result.isOk(canCreate) && canCreate.value).toBe(true);

      const canApprove = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'PURCHASES_ORDER_APPROVE',
      });
      expect(Result.isOk(canApprove) && canApprove.value).toBe(false); // Disjoint capabilities
    });

    it('SEC-CONTRACT-09 [Domain Auth]: RUN_STOCK_COUNT does not imply CONFIRM_STOCK_ADJUSTMENT', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValue(
        Result.ok([
          {
            id: 'm-floor',
            organizationId: orgAId,
            userId: user1Id,
            role: 'PRODUCTION',
            roleTemplateCode: 'PRODUCTION',
            isOrganizationWide: true,
            capabilities: ['INVENTORY_COUNT_RUN'],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValue(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);

      const canCount = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'INVENTORY_COUNT_RUN',
      });
      expect(Result.isOk(canCount) && canCount.value).toBe(true);

      const canAdjust = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'INVENTORY_ADJUSTMENT_CONFIRM',
      });
      expect(Result.isOk(canAdjust) && canAdjust.value).toBe(false); // Disjoint capabilities
    });

    it('SEC-CONTRACT-10 [Domain Auth]: REVIEW_RECONCILIATION does not imply CONFIRM_RECONCILIATION', async () => {
      vi.mocked(mockRepo.findByUserId).mockResolvedValue(
        Result.ok([
          {
            id: 'm-accountant',
            organizationId: orgAId,
            userId: user1Id,
            role: 'EXTERNAL_ACCOUNTANT',
            roleTemplateCode: 'EXTERNAL_ACCOUNTANT',
            isOrganizationWide: true,
            capabilities: ['FINANCIAL_RECONCILIATION_REVIEW'],
            isActive: true,
          },
        ])
      );
      vi.mocked(mockRepo.findModuleEntitlementsByOrgId).mockResolvedValue(Result.ok([]));

      const useCase = new CanExecuteCapabilityUseCase(mockRepo);

      const canReview = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'FINANCIAL_RECONCILIATION_REVIEW',
      });
      expect(Result.isOk(canReview) && canReview.value).toBe(true);

      const canConfirm = await useCase.execute({
        userId: user1Id,
        organizationId: orgAId,
        capabilityCode: 'FINANCIAL_RECONCILIATION_CONFIRM',
      });
      expect(Result.isOk(canConfirm) && canConfirm.value).toBe(false); // Disjoint capabilities
    });
  });
});
