export type EntityId = string;

export interface BaseEntity {
  readonly id: EntityId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditableEntity extends BaseEntity {
  readonly createdBy?: EntityId;
  readonly updatedBy?: EntityId;
}
