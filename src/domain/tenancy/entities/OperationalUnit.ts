export type OperationalUnitType =
  | 'KITCHEN'
  | 'SALON'
  | 'BAR'
  | 'WAREHOUSE'
  | 'CENTRAL_OFFICE'
  | 'DELIVERY_HUB'
  | 'OTHER';

export interface OperationalUnit {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  unitType: OperationalUnitType;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
