import { IOrganizationMembershipRepository } from '../../../domain/tenancy/repositories/IOrganizationMembershipRepository';
import { Result } from '../../../shared/errors/Result';
import { AppError } from '../../../shared/errors/AppError';
import { OrganizationMembership } from '../../../domain/tenancy/entities/Membership';

export class ValidateActiveContextUseCase {
  constructor(private readonly membershipRepo: IOrganizationMembershipRepository) {}

  public async execute(userId: string, targetOrganizationId: string): Promise<Result<OrganizationMembership>> {
    if (!userId || !targetOrganizationId) {
      return Result.fail(AppError.validation('Both userId and targetOrganizationId are required'));
    }

    const membershipResult = await this.membershipRepo.findMembership(userId, targetOrganizationId);
    if (!membershipResult.success) {
      return Result.fail(membershipResult.error);
    }

    const membership = membershipResult.value;
    if (!membership || !membership.isActive) {
      return Result.fail(
        AppError.authorization(
          `Fail-Closed: User '${userId}' does not have active membership in target organization '${targetOrganizationId}'`
        )
      );
    }

    return Result.ok(membership);
  }
}
