export type SaleLineItemType = 'PRODUCT' | 'MODIFIER' | 'UNKNOWN';

export interface SaleLineProps {
  id: string;
  organizationId: string;
  saleId: string;
  lineIndex: number;
  depth: number;
  parentLineId?: string | null;
  rawText: string;
  displayText: string;
  quantity: number;
  itemType: SaleLineItemType;
  notes?: string | null;
  catalogProductId?: string | null;
  createdAt: Date;
}

export class SaleLine {
  private constructor(private readonly props: SaleLineProps) {}

  public static create(props: SaleLineProps): SaleLine {
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('SaleLine must belong to an explicit organizationId');
    }
    if (!props.saleId || props.saleId.trim() === '') {
      throw new Error('SaleLine must belong to a saleId');
    }
    if (!props.rawText || props.rawText.trim() === '') {
      throw new Error('SaleLine must retain non-empty rawText');
    }
    return new SaleLine({
      ...props,
      quantity: isNaN(props.quantity) || props.quantity <= 0 ? 1 : props.quantity,
      depth: props.depth >= 0 ? props.depth : 0,
      itemType: props.itemType || 'UNKNOWN',
      createdAt: props.createdAt || new Date(),
    });
  }

  public get id(): string { return this.props.id; }
  public get organizationId(): string { return this.props.organizationId; }
  public get saleId(): string { return this.props.saleId; }
  public get lineIndex(): number { return this.props.lineIndex; }
  public get depth(): number { return this.props.depth; }
  public get parentLineId(): string | null | undefined { return this.props.parentLineId; }
  public get rawText(): string { return this.props.rawText; }
  public get displayText(): string { return this.props.displayText; }
  public get quantity(): number { return this.props.quantity; }
  public get itemType(): SaleLineItemType { return this.props.itemType; }
  public get notes(): string | null | undefined { return this.props.notes; }
  public get catalogProductId(): string | null | undefined { return this.props.catalogProductId; }
  public get createdAt(): Date { return this.props.createdAt; }

  public toJSON(): SaleLineProps {
    return { ...this.props };
  }
}
