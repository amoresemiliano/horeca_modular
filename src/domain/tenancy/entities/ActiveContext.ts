export interface ActiveContext {
  userId: string;
  activeOrganizationId: string;
  activeHoldingId?: string | null;
  activeOperationalUnitId?: string | null;
  selectedAt: string;
}
