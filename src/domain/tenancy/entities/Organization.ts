import { AuditableEntity, EntityId } from '../../shared/types';

export interface Organization extends AuditableEntity {
  readonly legalName: string;
  readonly commercialName?: string;
  readonly taxId: string; // CIF / NIF
  readonly country: string;
  readonly isActive: boolean;
  readonly holdingId?: EntityId;
}
