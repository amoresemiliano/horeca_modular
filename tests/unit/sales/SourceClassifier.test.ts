import { describe, it, expect } from 'vitest';
import { SourceClassifier } from '../../../src/domain/sales/services/SourceClassifier';

describe('SourceClassifier Unit Tests', () => {
  it('accepts standard Last.app individual sales export headers', () => {
    const headers = [
      'Ubicación',
      'Código',
      'Nombre',
      'Fuente',
      'Factura nº',
      'Tipo de recogida',
      'Método de pago',
      'Hora de creación',
      'Total',
      'Pagado',
      'Productos',
    ];

    const result = SourceClassifier.classify(headers);
    expect(result.isValidForTicketIngestion).toBe(true);
    expect(result.exportType).toBe('LASTAPP_INDIVIDUAL_SALES');
    expect(result.sourceSystem).toBe('lastapp');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('rejects Last.app billing summary / customer invoice exports with clear diagnostics', () => {
    const headers = [
      'Customer Company Name',
      'Customer Company Tax Id',
      'Customer Company Address',
      'Activation Time',
      'Number',
      'Location Name',
      'Tab Id',
      'Id',
      'Total',
    ];

    const result = SourceClassifier.classify(headers);
    expect(result.isValidForTicketIngestion).toBe(false);
    expect(result.exportType).toBe('LASTAPP_BILLING_SUMMARY');
    expect(result.rejectionReason).toMatch(/Billing Summary/i);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('fails closed on unknown or arbitrary CSV headers', () => {
    const headers = ['RandomColumn1', 'RandomColumn2', 'Value'];
    const result = SourceClassifier.classify(headers);

    expect(result.isValidForTicketIngestion).toBe(false);
    expect(result.exportType).toBe('UNKNOWN_UNSUPPORTED');
    expect(result.diagnostics[0]).toMatch(/Failed to classify/i);
  });

  it('fails closed on empty headers', () => {
    const result = SourceClassifier.classify([]);
    expect(result.isValidForTicketIngestion).toBe(false);
    expect(result.exportType).toBe('UNKNOWN_UNSUPPORTED');
  });
});
