import { RoleTemplate } from '../authorization/roles';

export type CanonicalRoleCode =
  | 'VEGEN_PLATFORM_ADMIN'
  | 'HOLDING_OWNER'
  | 'HOLDING_ADMIN'
  | 'OWNER'
  | 'MANAGER'
  | 'ADMINISTRATIVE'
  | 'PURCHASING'
  | 'RECEPTION_FLOOR'
  | 'PRODUCTION'
  | 'COOK_COST_SHEET_MANAGER'
  | 'HR_PERSONNEL'
  | 'EXTERNAL_ACCOUNTANT'
  | 'CONSULTANT';

export interface CapabilityOverride {
  id?: string;
  capabilityCode: string;
  effect: 'GRANT' | 'REVOKE';
  operationalUnitId?: string | null;
}

export interface MembershipOperationalUnitScope {
  id?: string;
  membershipId: string;
  operationalUnitId: string;
  createdAt?: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: string; // Transitional legacy role string
  roleTemplateId?: string | null;
  roleTemplateCode?: CanonicalRoleCode | string | null;
  /**
   * Invariant:
   * When `isOrganizationWide` is true (or undefined/omitted), the member has organization-wide scope across all operational units.
   * When `isOrganizationWide` is explicitly false, access is strictly constrained to units in `operationalUnitScopes`.
   */
  isOrganizationWide?: boolean;
  operationalUnitScopes?: string[];
  /** @deprecated Kept for transitional compatibility; use `operationalUnitScopes` instead. */
  operationalUnitId?: string | null;
  capabilities?: string[];
  overrides?: CapabilityOverride[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizationMembership {
  id: string;
  userId: string;
  organizationId: string;
  roleTemplate: RoleTemplate;
  role?: string;
  isOrganizationWide?: boolean;
  operationalUnitScopes?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
