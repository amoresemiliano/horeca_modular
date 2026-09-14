export type CanonicalOperationalUnitType =
  | 'LOCAL'
  | 'WAREHOUSE'
  | 'PRODUCTION_CENTER'
  | 'OTHER';

export type OperationalUnitType = CanonicalOperationalUnitType;

export interface OperationalUnit {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  unitType: CanonicalOperationalUnitType;
  unitSubtype?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
