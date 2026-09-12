import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Membership } from '@/domain/tenancy/entities/Membership';
import { ModuleEntitlement } from '@/domain/tenancy/entities/ModuleEntitlement';
import { CanExecuteInput, CanExecuteInputSchema } from '../dtos/TenancyDto';

export class CanExecuteCapabilityUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(input: CanExecuteInput): Promise<Result<boolean, AppError>> {
    const parsed = CanExecuteInputSchema.safeParse(input);
    if (!parsed.success) {
      return Result.fail(AppError.validation('Invalid input for capability evaluation.', { reason: JSON.stringify(parsed.error.format()) }));
    }

    const { userId, organizationId, capabilityCode, operationalUnitId } = parsed.data;

    const membershipsResult = await this.membershipRepo.findByUserId(userId);
    if (!membershipsResult.success) {
      return Result.fail(membershipsResult.error);
    }

    const membership = membershipsResult.value.find(
      (m: Membership) => m.organizationId === organizationId && m.isActive !== false
    );

    if (!membership) {
      return Result.ok(false); // Fail-closed default DENY
    }

    // Check module entitlement if applicable
    const entitlementsResult = await this.membershipRepo.findModuleEntitlementsByOrgId(organizationId);
    if (entitlementsResult.success) {
      const entitlements = entitlementsResult.value;
      const capabilityPrefix = capabilityCode.split('_')[0].toLowerCase();
      const matchedEntitlement = entitlements.find(
        (e: ModuleEntitlement) => e.moduleKey.toLowerCase() === capabilityPrefix || capabilityCode.toLowerCase().startsWith(e.moduleKey.toLowerCase())
      );
      if (matchedEntitlement && !matchedEntitlement.isEnabled) {
        return Result.ok(false);
      }
    }

    // Check overrides
    if (membership.overrides && Array.isArray(membership.overrides)) {
      // Unit-specific override
      if (operationalUnitId) {
        const unitOverride = membership.overrides.find(
          (o) => o.capabilityCode === capabilityCode && o.operationalUnitId === operationalUnitId
        );
        if (unitOverride) {
          return Result.ok(unitOverride.effect === 'GRANT');
        }
      }

      // Org-level override
      const orgOverride = membership.overrides.find(
        (o) => o.capabilityCode === capabilityCode && (!o.operationalUnitId || o.operationalUnitId === null)
      );
      if (orgOverride) {
        return Result.ok(orgOverride.effect === 'GRANT');
      }
    }

    // Role template capability defaults
    const hasBaseCapability = (membership.capabilities || []).includes(capabilityCode);
    return Result.ok(hasBaseCapability);
  }
}
