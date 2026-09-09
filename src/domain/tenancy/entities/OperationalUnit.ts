import { AuditableEntity, EntityId } from '../../shared/types';

export interface OperationalUnit extends AuditableEntity {
  readonly organizationId: EntityId;
  readonly code: string;
  readonly name: string;
  readonly unitType: 'RESTAURANT' | 'CENTRAL_KITCHEN' | 'DARK_KITCHEN' | 'WAREHOUSE' | 'OFFICE';
  readonly address?: string;
  readonly isActive: boolean;
}
