import { UserIdentity } from '../../auth/types';
import { Capability } from './capabilities';
import { RoleTemplate, DEFAULT_ROLE_CAPABILITIES } from './roles';
import { ScopeType } from './scopes';

export interface AuthorizationEvaluationContext {
  readonly user: UserIdentity;
  readonly requiredCapability: Capability;
  readonly organizationId: string;
  readonly targetScope?: {
    readonly scopeType: ScopeType;
    readonly operationalUnitId?: string;
  };
  readonly moduleEntitlement?: {
    readonly moduleKey: string;
    readonly isEnabled: boolean;
  };
  readonly membership?: {
    readonly organizationId: string;
    readonly roleTemplate: RoleTemplate;
    readonly capabilityOverrides?: {
      readonly granted?: readonly Capability[];
      readonly revoked?: readonly Capability[];
    };
    readonly operationalUnitScopes?: readonly string[];
    readonly isActive: boolean;
  };
  readonly isPlatformAdmin?: boolean;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly evaluatedAt: string;
}

/**
 * Evaluates authorization according to canonical VEGEN chain:
 * can(user, capability, organization, operational_scope, entitlement, resource)
 *
 * DEFAULT: DENY
 */
export function can(ctx: AuthorizationEvaluationContext): AuthorizationDecision {
  const evaluatedAt = new Date().toISOString();

  // 1. User Identity & Active Status Check
  if (!ctx.user || !ctx.user.isActive) {
    return {
      allowed: false,
      reason: 'User identity is missing, invalid, or inactive',
      evaluatedAt,
    };
  }

  // 2. Module Entitlement Check
  if (ctx.moduleEntitlement && !ctx.moduleEntitlement.isEnabled) {
    return {
      allowed: false,
      reason: `Module '${ctx.moduleEntitlement.moduleKey}' is not entitled/enabled for this organization`,
      evaluatedAt,
    };
  }

  // 3. Platform Admin Segregation: Platform admin role does NOT grant routine tenant operational access
  if (ctx.isPlatformAdmin && !ctx.membership) {
    const isPlatformCapability = ctx.requiredCapability.startsWith('platform.');
    if (isPlatformCapability) {
      return {
        allowed: true,
        reason: 'Authorized via platform administrative authority',
        evaluatedAt,
      };
    }
    return {
      allowed: false,
      reason: 'Platform control does not grant routine tenant operational data access without explicit membership',
      evaluatedAt,
    };
  }

  // 4. Organization Membership Validation (Fail-Closed)
  if (!ctx.membership || !ctx.membership.isActive) {
    return {
      allowed: false,
      reason: 'Active membership for target organization is missing or inactive',
      evaluatedAt,
    };
  }

  if (ctx.membership.organizationId !== ctx.organizationId) {
    return {
      allowed: false,
      reason: 'Membership organization ID does not match evaluation target organization',
      evaluatedAt,
    };
  }

  // 5. Capability Resolution: Role Template Defaults + Overrides
  const defaultCaps = DEFAULT_ROLE_CAPABILITIES[ctx.membership.roleTemplate] || [];
  const grantedOverrides = ctx.membership.capabilityOverrides?.granted || [];
  const revokedOverrides = ctx.membership.capabilityOverrides?.revoked || [];

  const effectiveCapabilities = new Set<Capability>([...defaultCaps, ...grantedOverrides]);
  for (const revoked of revokedOverrides) {
    effectiveCapabilities.delete(revoked);
  }

  if (!effectiveCapabilities.has(ctx.requiredCapability)) {
    return {
      allowed: false,
      reason: `User lacks required capability '${ctx.requiredCapability}' in role template '${ctx.membership.roleTemplate}'`,
      evaluatedAt,
    };
  }

  // 6. OperationalUnit Scope Validation
  if (ctx.targetScope && ctx.targetScope.scopeType === ScopeType.OPERATIONAL_UNIT) {
    const targetUnitId = ctx.targetScope.operationalUnitId;
    if (targetUnitId) {
      const allowedUnits = ctx.membership.operationalUnitScopes;
      // If user has restricted operational scopes, targetUnit must be in allowed list
      if (allowedUnits && allowedUnits.length > 0 && !allowedUnits.includes(targetUnitId)) {
        return {
          allowed: false,
          reason: `User operational scope does not include operational unit '${targetUnitId}'`,
          evaluatedAt,
        };
      }
    }
  }

  // 7. Authorization Passed
  return {
    allowed: true,
    reason: 'Authorized by valid membership, effective capabilities, and scope matching',
    evaluatedAt,
  };
}
