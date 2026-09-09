import { AuditableEntity, EntityId } from '../../shared/types';
import { RoleTemplate } from '../authorization/roles';
import { Capability } from '../authorization/capabilities';

export interface CapabilityOverrides {
  readonly granted?: readonly Capability[];
  readonly revoked?: readonly Capability[];
}

export interface OrganizationMembership extends AuditableEntity {
  readonly userId: EntityId;
  readonly organizationId: EntityId;
  readonly roleTemplate: RoleTemplate;
  readonly capabilityOverrides?: CapabilityOverrides;
  readonly operationalUnitScopes?: readonly EntityId[];
  readonly isActive: boolean;
}
