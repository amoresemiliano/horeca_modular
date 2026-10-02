export type SaleStatus = 'CONFIRMED' | 'VOIDED' | 'REFUNDED' | 'OPEN' | 'REVIEW_REQUIRED';

export interface SaleProps {
  id: string;
  organizationId: string;
  operationalUnitId?: string | null;
  salesImportId: string;
  sourceSystem: string; // e.g. 'lastapp'
  exportType: string;   // e.g. 'INDIVIDUAL_SALES_EXPORT'
  sourceLocation: string; // e.g. 'El Criollo - Palencia'
  externalTicketCode: string; // e.g. 'R001'
  externalInvoiceNumber?: string | null; // e.g. 'LS2-10688'
  externalIdentityKey: string; // SHA-256 hash
  externalIdentityAlgorithm: string; // e.g. 'INVOICE_V1' | 'CODE_TIME_V1'
  occurredAt: Date;
  sourceChannel?: string | null; // 'Restaurant', 'Uber', 'Glovo', 'Shop', etc.
  sourcePaymentMethod?: string | null; // 'card', 'cash', 'uber', etc.
  total: number; // authoritative ticket total in EUR
  paidAmount?: number | null;
  currency: string; // 'EUR'
  status: SaleStatus;
  rawPayload?: Record<string, unknown>;
  externalLocationId?: string;
  externalSaleId?: string;
  syncRunId?: string;
  sourceAdapterVersion?: string;
  sourceObservedAt?: string;
  sourceFingerprint?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Sale {
  private constructor(private readonly props: SaleProps) {}

  public static create(props: SaleProps): Sale {
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('Sale must belong to an explicit organizationId');
    }
    if (!props.externalIdentityKey || props.externalIdentityKey.trim() === '') {
      throw new Error('Sale must have a non-empty externalIdentityKey');
    }
    if (isNaN(props.total)) {
      throw new Error('Sale total must be a valid number');
    }
    return new Sale({
      ...props,
      currency: props.currency || 'EUR',
      status: props.status || 'CONFIRMED',
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }

  public get id(): string { return this.props.id; }
  public get organizationId(): string { return this.props.organizationId; }
  public get operationalUnitId(): string | null | undefined { return this.props.operationalUnitId; }
  public get salesImportId(): string { return this.props.salesImportId; }
  public get sourceSystem(): string { return this.props.sourceSystem; }
  public get exportType(): string { return this.props.exportType; }
  public get sourceLocation(): string { return this.props.sourceLocation; }
  public get externalTicketCode(): string { return this.props.externalTicketCode; }
  public get externalInvoiceNumber(): string | null | undefined { return this.props.externalInvoiceNumber; }
  public get externalIdentityKey(): string { return this.props.externalIdentityKey; }
  public get externalIdentityAlgorithm(): string { return this.props.externalIdentityAlgorithm; }
  public get occurredAt(): Date { return this.props.occurredAt; }
  public get sourceChannel(): string | null | undefined { return this.props.sourceChannel; }
  public get sourcePaymentMethod(): string | null | undefined { return this.props.sourcePaymentMethod; }
  public get total(): number { return this.props.total; }
  public get paidAmount(): number | null | undefined { return this.props.paidAmount; }
  public get currency(): string { return this.props.currency; }
  public get status(): SaleStatus { return this.props.status; }
  public get rawPayload(): Record<string, unknown> | undefined { return this.props.rawPayload; }
  public get externalLocationId(): string | undefined { return this.props.externalLocationId; }
  public get externalSaleId(): string | undefined { return this.props.externalSaleId; }
  public get syncRunId(): string | undefined { return this.props.syncRunId; }
  public get sourceAdapterVersion(): string | undefined { return this.props.sourceAdapterVersion; }
  public get sourceObservedAt(): string | undefined { return this.props.sourceObservedAt; }
  public get sourceFingerprint(): string | undefined { return this.props.sourceFingerprint; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public toJSON(): SaleProps {
    return { ...this.props };
  }
}
