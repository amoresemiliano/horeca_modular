import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Membership } from '@/domain/tenancy/entities/Membership';

export class ResolveEffectiveCapabilitiesUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(userId: string, organizationId: string): Promise<Result<string[], AppError>> {
    if (!userId || !organizationId) {
      return Result.fail(AppError.validation('UserId and OrganizationId are required.'));
    }

    const membershipsResult = await this.membershipRepo.findByUserId(userId);
    if (!membershipsResult.success) {
      return Result.fail(membershipsResult.error);
    }

    const membership = membershipsResult.value.find(
      (m: Membership) => m.organizationId === organizationId && m.isActive !== false
    );

    if (!membership) {
      return Result.fail(AppError.authorization('Active membership not found for this organization.'));
    }

    const baseCapabilities = new Set<string>(membership.capabilities || []);

    if (membership.overrides && Array.isArray(membership.overrides)) {
      for (const override of membership.overrides) {
        if (override.effect === 'GRANT') {
          baseCapabilities.add(override.capabilityCode);
        } else if (override.effect === 'REVOKE') {
          baseCapabilities.delete(override.capabilityCode);
        }
      }
    }

    return Result.ok(Array.from(baseCapabilities));
  }
}
