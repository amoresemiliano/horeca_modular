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

    const hasMembership = membershipsResult.value.some(
      (m: Membership) => m.organizationId === organizationId && m.isActive !== false
    );
    if (!hasMembership) {
      return Result.fail(AppError.authorization('User does not have an active membership in the requested organization.'));
    }

    return this.membershipRepo.findOperationalUnitsByOrgId(organizationId);
  }
}
