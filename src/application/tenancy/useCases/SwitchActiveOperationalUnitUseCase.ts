import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { IOrganizationMembershipRepository } from '@/domain/tenancy/repositories/IOrganizationMembershipRepository';
import { ActiveContext } from '@/domain/tenancy/entities/ActiveContext';
import { Membership } from '@/domain/tenancy/entities/Membership';
import { OperationalUnit } from '@/domain/tenancy/entities/OperationalUnit';
import { SwitchOperationalUnitInput, SwitchOperationalUnitInputSchema } from '../dtos/TenancyDto';

export class SwitchActiveOperationalUnitUseCase {
  constructor(private membershipRepo: IOrganizationMembershipRepository) {}

  async execute(input: SwitchOperationalUnitInput): Promise<Result<ActiveContext, AppError>> {
    const parsed = SwitchOperationalUnitInputSchema.safeParse(input);
    if (!parsed.success) {
      return Result.fail(AppError.validation('Invalid input for switching operational unit.', { reason: JSON.stringify(parsed.error.format()) }));
    }

    const { userId, organizationId, targetOperationalUnitId } = parsed.data;

    const membershipsResult = await this.membershipRepo.findByUserId(userId);
    if (!membershipsResult.success) {
      return Result.fail(membershipsResult.error);
    }

    const membership = membershipsResult.value.find(
      (m: Membership) => m.organizationId === organizationId && m.isActive !== false
    );

    if (!membership) {
      return Result.fail(AppError.authorization('User does not have active membership in the organization.'));
    }

    if (targetOperationalUnitId) {
      const unitsResult = await this.membershipRepo.findOperationalUnitsByOrgId(organizationId);
      if (!unitsResult.success) {
        return Result.fail(unitsResult.error);
      }
      const unitExists = unitsResult.value.some((u: OperationalUnit) => u.id === targetOperationalUnitId && u.isActive);
      if (!unitExists) {
        return Result.fail(AppError.notFound('Target operational unit not found or inactive.'));
      }
    }

    const activeContext: ActiveContext = {
      userId,
      activeOrganizationId: organizationId,
      activeOperationalUnitId: targetOperationalUnitId || null,
      selectedAt: new Date().toISOString(),
    };

    return Result.ok(activeContext);
  }
}
