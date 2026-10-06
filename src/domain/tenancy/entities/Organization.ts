export interface Organization {
  id: string;
  name?: string;
  legalName?: string | null;
  commercialName?: string;
  taxId?: string | null;
  taxIdType?: string | null;
  holdingId?: string | null;
  tradeName?: string | null;
  country?: string;
  countryCode?: string | null;
  currency?: string | null;
  timezone?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
