export type SalesMappingType = 'LOCATION_TO_OPUNIT' | 'PRODUCT_TO_CATALOG';

export interface SalesMappingProps {
  id: string;
  organizationId: string;
  mappingType: SalesMappingType;
  sourceValue: string; // e.g. 'El Criollo - Palencia' or 'TACOS - Carnitas'
  targetId: string;    // e.g. operationalUnitId or catalogProductId
  targetName?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SalesMapping {
  private constructor(private readonly props: SalesMappingProps) {}

  public static create(props: SalesMappingProps): SalesMapping {
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('SalesMapping must belong to an explicit organizationId');
    }
    if (!props.sourceValue || props.sourceValue.trim() === '') {
      throw new Error('SalesMapping must specify a sourceValue');
    }
    return new SalesMapping({
      ...props,
      isActive: props.isActive !== undefined ? props.isActive : true,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }

  public get id(): string { return this.props.id; }
  public get organizationId(): string { return this.props.organizationId; }
  public get mappingType(): SalesMappingType { return this.props.mappingType; }
  public get sourceValue(): string { return this.props.sourceValue; }
  public get targetId(): string { return this.props.targetId; }
  public get targetName(): string | null | undefined { return this.props.targetName; }
  public get isActive(): boolean { return this.props.isActive; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public toJSON(): SalesMappingProps {
    return { ...this.props };
  }
}
