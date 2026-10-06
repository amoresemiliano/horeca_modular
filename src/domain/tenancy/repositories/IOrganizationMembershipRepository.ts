import { Result } from '@/shared/errors/Result';
import { AppError } from '@/shared/errors/AppError';
import { Membership, OrganizationMembership } from '../entities/Membership';
import { Organization } from '../entities/Organization';
import { OperationalUnit } from '../entities/OperationalUnit';
import { ModuleEntitlement } from '../entities/ModuleEntitlement';

export interface UserOrganizationContext {
  readonly organization: Organization;
  readonly membership: OrganizationMembership;
}

export interface IOrganizationMembershipRepository {
  findByUserId(userId: string): Promise<Result<Membership[], AppError>>;
  findPrimaryByUserId(userId: string): Promise<Result<Membership | null, AppError>>;
  findOrganizationsByUserId(userId: string): Promise<Result<Organization[], AppError>>;
  findOperationalUnitsByOrgId(orgId: string): Promise<Result<OperationalUnit[], AppError>>;
  findModuleEntitlementsByOrgId(orgId: string): Promise<Result<ModuleEntitlement[], AppError>>;

  // Legacy compat methods
  findUserOrganizations(userId: string): Promise<Result<readonly UserOrganizationContext[], AppError>>;
  findMembership(userId: string, organizationId: string): Promise<Result<OrganizationMembership | null, AppError>>;
  getActiveContext(userId: string): Promise<Result<string | null, AppError>>;
  setActiveContext(userId: string, organizationId: string): Promise<Result<void, AppError>>;
}
