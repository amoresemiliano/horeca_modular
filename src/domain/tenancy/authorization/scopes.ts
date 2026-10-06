export const ScopeType = {
  PLATFORM: 'PLATFORM',
  HOLDING: 'HOLDING',
  ORGANIZATION: 'ORGANIZATION',
  OPERATIONAL_UNIT: 'OPERATIONAL_UNIT',
  SENSITIVE_DATA: 'SENSITIVE_DATA',
} as const;

export type ScopeType = (typeof ScopeType)[keyof typeof ScopeType];

export interface ScopeConstraint {
  readonly scopeType: ScopeType;
  readonly scopeTargetId?: string; // e.g. organization_id or operational_unit_id
}
