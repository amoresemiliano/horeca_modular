import { EntityId } from '../../shared/types';
import { OrganizationMembership } from '../entities/Membership';
import { Organization } from '../entities/Organization';
import { Result } from '../../../shared/errors/Result';

export interface UserOrganizationContext {
  readonly organization: Organization;
  readonly membership: OrganizationMembership;
}

export interface IOrganizationMembershipRepository {
  /**
   * Find all active organization memberships for a user.
   */
  findUserOrganizations(userId: EntityId): Promise<Result<readonly UserOrganizationContext[]>>;

  /**
   * Find a specific user membership in a target organization.
   */
  findMembership(userId: EntityId, organizationId: EntityId): Promise<Result<OrganizationMembership | null>>;

  /**
   * Get currently persisted active context for a user session.
   */
  getActiveContext(userId: EntityId): Promise<Result<EntityId | null>>;

  /**
   * Update active context for a user session.
   */
  setActiveContext(userId: EntityId, organizationId: EntityId): Promise<Result<void>>;
}
