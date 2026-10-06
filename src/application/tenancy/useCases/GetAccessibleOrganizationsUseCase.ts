import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Organization } from '@/domain/tenancy/entities/Organization';

export class GetAccessibleOrganizationsUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(userId: string): Promise<Result<Organization[], AppError>> {
    if (!userId) {
      return Result.fail(AppError.validation('UserId is required to fetch accessible organizations.'));
    }
    const orgsResult = await this.membershipRepo.findOrganizationsByUserId(userId);
    if (!orgsResult.success) {
      return Result.fail(orgsResult.error);
    }
    return Result.ok(orgsResult.value);
  }
}
