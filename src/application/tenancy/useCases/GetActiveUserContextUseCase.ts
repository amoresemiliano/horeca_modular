import { IOrganizationMembershipRepository } from '../../../domain/tenancy/repositories/IOrganizationMembershipRepository';
import { ActiveContextResponseDto } from '../dtos/ActiveContextDto';
import { Result } from '../../../shared/errors/Result';
import { AppError } from '../../../shared/errors/AppError';

export class GetActiveUserContextUseCase {
  constructor(private readonly membershipRepo: IOrganizationMembershipRepository) {}

  public async execute(userId: string, requestedOrgId?: string): Promise<Result<ActiveContextResponseDto>> {
    if (!userId) {
      return Result.fail(AppError.validation('User ID is required to resolve active context'));
    }

    // 1. Fetch all active memberships
    const userOrgsResult = await this.membershipRepo.findUserOrganizations(userId);
    if (!userOrgsResult.success) {
      return Result.fail(userOrgsResult.error);
    }

    const organizations = userOrgsResult.value;
    if (organizations.length === 0) {
      return Result.fail(AppError.notFound('No active organization memberships found for user'));
    }

    // 2. Resolve target organization ID
    let targetOrgId = requestedOrgId;

    if (!targetOrgId) {
      // Check stored session preference
      const storedContextResult = await this.membershipRepo.getActiveContext(userId);
      if (storedContextResult.success && storedContextResult.value) {
        targetOrgId = storedContextResult.value;
      } else {
        // Fallback to primary / first available active organization
        const primary = organizations[0];
        if (primary) {
          targetOrgId = primary.organization.id;
        }
      }
    }

    // 3. Validate user has active membership in target organization (Fail-Closed)
    const activeContextItem = organizations.find((item) => item.organization.id === targetOrgId);
    if (!activeContextItem) {
      return Result.fail(
        AppError.authorization(`Access denied: User does not hold active membership in organization '${targetOrgId}'`)
      );
    }

    // 4. Build response DTO
    const responseDto: ActiveContextResponseDto = {
      activeOrganizationId: activeContextItem.organization.id,
      legalName: activeContextItem.organization.legalName || activeContextItem.organization.name || '',
      taxId: activeContextItem.organization.taxId || '',
      roleTemplate: activeContextItem.membership.roleTemplate,
      availableOrganizations: organizations.map((item) => ({
        id: item.organization.id,
        legalName: item.organization.legalName || item.organization.name || '',
        taxId: item.organization.taxId || '',
        roleTemplate: item.membership.roleTemplate,
      })),
    };

    return Result.ok(responseDto);
  }
}
