export type HoldingRole = 'HOLDING_OWNER' | 'HOLDING_ADMIN';

export interface HoldingMembership {
  id: string;
  holdingId: string;
  userId: string;
  role: HoldingRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
