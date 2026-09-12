export interface ModuleEntitlement {
  id: string;
  organizationId: string;
  moduleKey: string;
  isEnabled: boolean;
  planTier: string;
  settings?: Record<string, unknown>;
}
