import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { ActiveContext } from '@/domain/tenancy/entities/ActiveContext';
import { Membership } from '@/domain/tenancy/entities/Membership';
import { SwitchOrganizationInput, SwitchOrganizationInputSchema } from '../dtos/TenancyDto';

export class SwitchActiveOrganizationUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(input: SwitchOrganizationInput): Promise<Result<ActiveContext, AppError>> {
    const parsed = SwitchOrganizationInputSchema.safeParse(input);
    if (!parsed.success) {
      return Result.fail(AppError.validation('Invalid input for switching organization.', { reason: JSON.stringify(parsed.error.format()) }));
    }

    const { userId, targetOrganizationId } = parsed.data;

    const membershipsResult = await this.membershipRepo.findByUserId(userId);
    if (!membershipsResult.success) {
      return Result.fail(membershipsResult.error);
    }

    const membership = membershipsResult.value.find(
      (m: Membership) => m.organizationId === targetOrganizationId && m.isActive !== false
    );

    if (!membership) {
      return Result.fail(AppError.authorization('User does not have active membership in the target organization.'));
    }

    const activeContext: ActiveContext = {
      userId,
      activeOrganizationId: targetOrganizationId,
      activeOperationalUnitId: membership.operationalUnitId || null,
      selectedAt: new Date().toISOString(),
    };

    return Result.ok(activeContext);
  }
}
