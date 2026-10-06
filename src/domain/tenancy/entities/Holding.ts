export interface Holding {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  countryCode: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
