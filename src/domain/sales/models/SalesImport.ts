export type SalesImportStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'REJECTED';

export interface SalesImportProps {
  id: string;
  organizationId: string;
  sourceSystem: string;
  exportType: string;
  filename: string;
  fileHash?: string | null;
  status: SalesImportStatus;
  rowsAttempted: number;
  rowsAccepted: number;
  rowsDuplicate: number;
  rowsRejected: number;
  totalRevenue: number;
  errorSummary?: string | null;
  diagnostics?: Array<{
    rowNumber?: number;
    code?: string;
    message: string;
    level: 'INFO' | 'WARN' | 'ERROR';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class SalesImport {
  private constructor(private readonly props: SalesImportProps) {}

  public static create(props: SalesImportProps): SalesImport {
    if (!props.organizationId || props.organizationId.trim() === '') {
      throw new Error('SalesImport must belong to an explicit organizationId');
    }
    return new SalesImport({
      ...props,
      diagnostics: props.diagnostics || [],
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }

  public get id(): string { return this.props.id; }
  public get organizationId(): string { return this.props.organizationId; }
  public get sourceSystem(): string { return this.props.sourceSystem; }
  public get exportType(): string { return this.props.exportType; }
  public get filename(): string { return this.props.filename; }
  public get fileHash(): string | null | undefined { return this.props.fileHash; }
  public get status(): SalesImportStatus { return this.props.status; }
  public get rowsAttempted(): number { return this.props.rowsAttempted; }
  public get rowsAccepted(): number { return this.props.rowsAccepted; }
  public get rowsDuplicate(): number { return this.props.rowsDuplicate; }
  public get rowsRejected(): number { return this.props.rowsRejected; }
  public get totalRevenue(): number { return this.props.totalRevenue; }
  public get errorSummary(): string | null | undefined { return this.props.errorSummary; }
  public get diagnostics() { return this.props.diagnostics || []; }
  public get createdAt(): Date { return this.props.createdAt; }
  public get updatedAt(): Date { return this.props.updatedAt; }

  public toJSON(): SalesImportProps {
    return { ...this.props };
  }
}
