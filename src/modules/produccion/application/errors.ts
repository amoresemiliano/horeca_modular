const messages: Record<string, string> = {
  OWNER_CONTRACT_UNAVAILABLE: 'El catálogo y los destinos de producción todavía no están disponibles. No se ha guardado la operación.',
  STALE_REVISION: 'Este lote ha cambiado. Actualiza los datos antes de revisar y volver a enviar la operación.',
  DRAFT_CONFIRMATION_MISMATCH: 'El borrador o su conversión han cambiado. Actualiza y revisa las cantidades de nuevo.',
  IDEMPOTENCY_CONFLICT: 'Esta solicitud ya se utilizó con otros datos. Actualiza el lote antes de continuar.',
  PRODUCTION_ACCESS_DENIED: 'No tienes permiso para esta operación en la organización y unidad seleccionadas.',
  PRODUCTION_READ_FAILED: 'No se ha podido cargar Producción. Puedes volver a intentarlo.',
  UNKNOWN_OR_INVALID_CONVERSION: 'La conversión del envase no está disponible. Selecciona un envase aprobado.',
  REFERENCE_DENIED: 'La referencia seleccionada no está disponible para esta unidad.',
  INVALID_EXECUTION: 'Revisa la fecha, el producto, el destino y las cantidades.',
  INVALID_PACKAGE_COUNT: 'El número de envases debe ser un entero positivo.',
  WASTE_EXCEEDS_DECLARED_MATERIAL: 'La merma supera la cantidad declarada para ese material.',
  WASTE_NOT_FOUND_OR_SUPERSEDED: 'La merma pertenece a una ejecución sustituida. Actualiza el lote.',
};
export class ProductionError extends Error {
  constructor(readonly code: string) { super(code); }
}
export function safeProductionCode(error: { code?: string; message?: string }): string {
  if (error.message && Object.hasOwn(messages, error.message)) return error.message;
  if (error.code === '42501') return 'PRODUCTION_ACCESS_DENIED';
  return 'PRODUCTION_COMMAND_FAILED';
}
export function productionMessage(error: unknown): string {
  return error instanceof Error && Object.hasOwn(messages, error.message)
    ? messages[error.message] : 'No se ha podido completar la operación. Reintenta la misma solicitud o actualiza los datos.';
}
