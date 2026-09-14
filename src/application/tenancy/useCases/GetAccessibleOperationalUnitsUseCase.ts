import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { OperationalUnit } from '@/domain/tenancy/entities/OperationalUnit';
import { Membership } from '@/domain/tenancy/entities/Membership';

export class GetAccessibleOperationalUnitsUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(userId: string, organizationId: string): Promise<Result<OperationalUnit[], AppError>> {
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
      return Result.fail(AppError.authorization('User does not have an active membership in the requested organization.'));
    }

    const unitsResult = await this.membershipRepo.findOperationalUnitsByOrgId(organizationId);
    if (!unitsResult.success) {
      return Result.fail(unitsResult.error);
    }

    // If organization-wide, return all active units in org
    if (membership.isOrganizationWide) {
      return Result.ok(unitsResult.value);
    }

    // Otherwise, filter strictly by assigned operationalUnitScopes
    const allowedScopes = new Set(membership.operationalUnitScopes || []);
    const scopedUnits = unitsResult.value.filter((u: OperationalUnit) => allowedScopes.has(u.id));
    return Result.ok(scopedUnits);
  }
}
