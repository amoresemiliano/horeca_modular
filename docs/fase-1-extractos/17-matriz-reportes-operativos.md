# 17 - Matriz de Reportes Operativos HORECA (TPV, Delivery y Bancos)

## 1. Misión Documental y Enfoque de Hechos Operativos

En el ecosistema del restaurante y la taquería, las distintas plataformas tecnológicas y bancarias generan informes que documentan parcelas diferenciadas de la actividad operativa. En estricto apego al **Control de Calidad (Fase 0.5)** y rechazando términos propios de la contabilidad oficial o afirmaciones dogmáticas sobre una supuesta jerarquía universal, este documento inventaría las fuentes reales autorizadas del espacio de trabajo y clasifica para qué hecho operativo concreto cada reporte constituye la fuente principal conocida.

> **RECORDATORIO METODOLÓGICO Y DE TERMINOLOGÍA ECONÓMICA:**  
> Este documento es exclusivamente de diseño arquitectónico y análisis operativo.  
> Se utiliza una terminología estrictamente económica orientada al **movimiento económico, descuento, coste, comisión, ajuste, incidencia, clasificación, conciliación, dato fiscal informativo y preparación para gestoría**, prescindiendo formalmente de términos de contabilidad oficial de libros mercantiles tales como *"asiento"*, *"libro contable"*, *"cuenta patrimonial"*, *"imputación tributaria"* o *"deducción contable"*.

---

## 2. Jerarquía Modular por Hecho Operativo Concreto

No existe en el sistema ninguna fuente universal de verdad ni se declara una supremacía teórica respecto al conjunto del negocio. Cada fuente digital es reconocida exclusivamente como la **fuente principal conocida** para un hecho económico concreto:

| Hecho operativo o económico | Fuente principal conocida |
| :--- | :--- |
| **Ticket registrado** | `Last.app tabs-report` (`tabs-report-0.xlsx` y `tabs-report-0 (1).xlsx`) |
| **Productos del ticket** | `Last.app tabs-report` (`tabs-report-0.xlsx` y `tabs-report-0 (1).xlsx`) |
| **Método declarado** | `Last.app tabs-report` (`tabs-report-0.xlsx` y `tabs-report-0 (1).xlsx`) |
| **Pedido Uber** | Uber detalle (`5578cf56...csv`) |
| **Pedido Glovo** | Glovo detalle (`invoice-200112939041.XLSX`) |
| **Comisión** | Plataforma de delivery (Uber / Glovo) |
| **Liquidación** | Plataforma de delivery (Uber / Glovo) |
| **Dinero acreditado** | Banco (Extractos bancarios en `.xls` / `.xlsx`) |
| **Caja** | Movimientos y cierre de caja (`Movimientos.xlsx` / Cierres TPV) |

*Norma de preservación de diferencias:* Las diferencias numéricas o de registro emergentes entre distintas fuentes (por ejemplo, el total tarifado en el terminal TPV frente a la transferencia neta en el banco) no deben ocultarse, forzarse, sobrescribirse ni purgarse. **Las diferencias entre fuentes deben conservarse de manera íntegra y quedar visibles para su revisión humana posterior.**

---

## 3. Matriz General de Reportes Operativos Autorizados

A continuación se detalla obligatoriamente la matriz analítica con la totalidad de reportes, volcados y extractos disponibles en el espacio de trabajo de **Taquería El Criollo**:

| Fuente | Ruta exacta | Reporte | Formato | Granularidad | Tipo | Hecho principal | Claves disponibles | Fuente principal para | Riesgo de duplicación | Frecuencia |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Last.app** | `reportes_elcriollo/Last.app/tabs-report-0.xlsx` | `tabs-report` | `.xlsx` | Detallada (por fila/comanda) | Primario transaccional | Venta bruta del servicio y detalle de líneas | `Tab Id`, `código de cuenta`, `número de factura`, `fecha y hora` | Ticket registrado, Productos del ticket, Método declarado | Alto (si se reimporta el mismo periodo o se carga junto a informes secundarios) | Diaria |
| **Last.app** | `reportes_elcriollo/Last.app/tabs-report-0 (1).xlsx` | `tabs-report` (Periodo complementario) | `.xlsx` | Detallada (por fila/comanda) | Primario transaccional | Venta bruta del servicio y detalle de líneas | `Tab Id`, `código de cuenta`, `número de factura`, `fecha y hora` | Ticket registrado, Productos del ticket, Método declarado | Alto (solapamiento eventual de fechas y turnos con `tabs-report-0.xlsx`) | Diaria / Según descarga |
| **Last.app** | `reportes_elcriollo/Last.app/Reporte Ventas y Asientos (2).xlsx` | Reporte Ventas y Asientos | `.xlsx` | Agregada por turno / sesión consolidada | Control de validación | Balance sumatorio de turnos y desglose de cobro | `fecha`, `ubicación` (`Tab Id`: `NO DISPONIBLE`, `número de factura`: `NO DISPONIBLE`) | Validación secundaria de sumatorios de turno y comprobación | Alto (no debe sumar ventas si ya se cargó `tabs-report`) | Semanal / Mensual |
| **Last.app** | `reportes_elcriollo/Last.app/Movimientos.xlsx` | Movimientos | `.xlsx` | Detallada (flujo entrante / saliente de efectivo) | Operativo de caja | Movimiento de entrada, salida y ajustes de efectivo en local | `fecha y hora`, `concepto`, `usuario` (`número de factura`: `NO DISPONIBLE`) | Caja (flujos físicos de efectivo en tienda) | Medio (posible duplicidad si se confunde con abono en cuenta) | Diaria |
| **Last.app** | `reportes_elcriollo/Last.app/Reporte de pedidos.xlsx` | Reporte de pedidos | `.xlsx` | Detallada (órdenes a cocina y mostrador) | Control operativo | Comanda procesada y tiempos de servicio | `código de cuenta`, `fecha y hora`, `canal` (`número de factura`: `NO DISPONIBLE`) | Tiempos y volumen de comandas enviadas a preparación | Medio (comprobación operativa de barra y almacén) | Diaria / Periódica |
| **Last.app** | `reportes_elcriollo/Last.app/Pagos.xlsx` | Pagos | `.xlsx` | Detallada (transacciones por instrumento) | Control operativo | Cobro capturado por datáfono, efectivo o plataforma | `fecha y hora`, `método de pago`, `importe`, `código de cuenta` | Auditoría por instrumento de cobro (efectivo vs. tarjetas) | Medio (riesgo de duplicación si se suma sobre tickets ya liquidados) | Diaria / Semanal |
| **Last.app** | `reportes_elcriollo/Last.app/Facturas.xlsx` | Facturas | `.xlsx` | Detallada (comprobantes fiscales emitidos) | Registro fiscal informativo | Factura simplificada o completa expedida a comensal | `número de factura`, `fecha y hora`, `total`, `NIF/CIF` cliente | Control de numeración de facturas expedidas (preparación gestoría) | Medio (no debe computarse adicionalmente al ticket gastronómico) | Semanal / Mensual |
| **Last.app** | `reportes_elcriollo/Last.app/Facturas eliminadas.xlsx` | Facturas eliminadas *(y `Facturas eliminadas totales.xlsx`)* | `.xlsx` | Detallada (facturas abortadas/canceladas) | Auditoría e incidencias | Factura fiscal anulada o suprimida por operador | `número de factura`, `fecha y hora`, `motivo`, `usuario` | Control de incidencias de facturación e investigación de anulaciones | Bajo (registro de exclusión e incidencia, saldo = 0) | Según ocurrencia / Semanal |
| **Last.app** | `reportes_elcriollo/Last.app/Productos eliminados.xlsx` | Productos eliminados | `.xlsx` | Detallada (líneas borradas de comanda) | Auditoría e incidencias | Ítem o modificador retirado del encargo tras enviarse | `fecha y hora`, `producto`, `código de cuenta`, `usuario`, `motivo` | Incidencias operativas de cocina, mermas y auditoría de barra | Bajo (registro analítico de mermas y control interno) | Diaria / Semanal |
| **Last.app** | `reportes_elcriollo/Last.app/cashbook.pdf` | `cashbook.pdf` (Libro / Justificantes de Caja) | `.pdf` | Agregada de cierre de turno | Documento justificativo | Arqueo físico de cierre y saldo final reportado del cajón | `fecha`, `ubicación` (`código de cuenta`: `NO DISPONIBLE`, `Tab Id`: `NO DISPONIBLE`) | Caja (evidencia justificativa PDF del arqueo físico firmado) | Alto (comprobante de lectura, no genera nuevos movimientos contables) | Diaria (al cierre de cada turno) |
| **Uber Eats** | `reportes_elcriollo/Uber/5578cf56-c0a2-4cfa-aa27-68e29679f104-europe_middle_east_africa.csv` | Uber detalle por pedido | `.csv` | Detallada (línea a línea por encargo) | Primario para agregador | Venta bruta en portal, comisiones logísticas, promociones y netos | `identificador interno` (Order UUID), `fecha y hora`, `total`, `neto` (`número de factura`: `NO DISPONIBLE`, `Tab Id`: `NO DISPONIBLE`) | Pedido Uber, Comisión y liquidación individual de la plataforma | Alto (prohíbese sumar como venta si las órdenes ya ingresaron por Last.app) | Semanal |
| **Uber Eats** | `reportes_elcriollo/Uber/1b9dc851-c6e8-49c8-84db-1c8ca0c01918-europe_middle_east_africa.csv` | Uber liquidaciones | `.csv` | Agregada (resumen por lote transferido) | Reporte de liquidación | Lote monetario neto enviado mediante remesa al banco | `fecha de pago`, `identificador de liquidación`, `neto transferido` (`código de cuenta`: `NO DISPONIBLE`) | Liquidación (emparejamiento contra transferencia real en banco) | Medio (utilizado exclusivamente en conciliación operativa N2) | Semanal / Quincenal |
| **Uber Eats** | `reportes_elcriollo/Uber/0298207f-0b72-5b79-aadf-c890a2f8827e_980f299e-eb49-5714-92b7-2d4cd465fbf7.pdf` *(y 2 PDF adicionales)* | Uber facturas PDF | `.pdf` | Consolidado mensual / semanal | Documento justificativo | Factura comercial por comisiones, servicios e IVA soportado | `número de factura` de Uber Eats B.V., `fecha`, `total comisión` | Soporte legal justificativo de costes y datos fiscales informativos | Alto (documento de soporte documental para preparación para gestoría) | Mensual / Según facturación |
| **Glovo** | `reportes_elcriollo/Glovo/invoice-200112939041.XLSX` | Glovo detalle Excel | `.xlsx` | Detallada y agregada por periodo | Primario para agregador | Desglose por encargo, tarifas logísticas de repartidor y saldo neto | `identificador interno` (Pedido GL), `fecha y hora`, `total`, `comisión` (`Tab Id`: `NO DISPONIBLE`, `número de factura`: `NO DISPONIBLE`) | Pedido Glovo, Comisión y liquidación de plataforma Glovo | Alto (no debe duplicar ventas si el pedido ya fue importado en `tabs-report`) | Semanal / Quincenal |
| **Glovo** | `reportes_elcriollo/Glovo/Invoicing Document-200112939041.PDF` | Glovo factura PDF | `.pdf` | Consolidado del ciclo de facturación | Documento justificativo | Factura legal por comisiones e IVA de intermediación digital | `número de factura` (#200112939041), `fecha`, `base`, `cuota IVA` | Soporte justificativo tributario del coste y comisión en España | Alto (adjunto justificativo inmutable para fiscalidad) | Por ciclo de liquidación |
| **BBVA** | `input-samples/extractos/Cta. BBVA MC.xls`, `Cta. BBVA MT.xls`, `Tarj. BBVA.xls` | Extractos BBVA | `.xls` / `.xlsx` / `.csv` | Detallada por movimiento bancario | Primario bancario | Movimientos monetarios reales en cuenta corriente o liquidación tarjeta | `fecha valor`, `concepto`, `importe`, `saldo` (`número de factura`: `NO DISPONIBLE`, `Tab Id`: `NO DISPONIBLE`) | Dinero acreditado en cuentas bancarias del establecimiento | Nulo en cuenta real; Medio en conciliación si se solapa la importación | Semanal / Mensual |
| **Banco Sabadell**| `input-samples/extractos/Cta. Sabadell.xls`, `Tarj. Sabadell.xls` | Extractos Sabadell | `.xls` / `.xlsx` / `.csv` | Detallada por movimiento bancario | Primario bancario | Ingresos, remesas de datáfono, transferencias de delivery y salidas en cuenta | `fecha valor`, `concepto`, `importe`, `saldo` (`número de factura`: `NO DISPONIBLE`, `código de cuenta`: `NO DISPONIBLE`) | Dinero acreditado en cuenta Sabadell y remesas de datáfono en tienda | Nulo en cuenta real; Medio en conciliación por solapamiento | Semanal / Mensual |

---

## 4. Reglas Estrictas de No Confunción entre Identificadores

Para garantizar la integridad y coherencia técnica en todos los conectores de parseo, se establece la distinción formal e inamovible entre los siguientes conceptos técnicos y relacionales:

* **`Tab Id`**: Identificador técnico UUID o alfanumérico largo generado internamente por la base de datos origen de Last.app para una sesión (ej. `f89c0211-a89f-...`). Prohíbese utilizar `Tab Id` como sinónimo de `código de cuenta`.
* **`Tab Code`**: Código corto o referencia numérica/alfanumérica asignado en la pantalla del TPV para la identificación visual y operativa de mesa o barra por parte de camareros y cocina (ej. `#C18A7` o `Mesa 4`). Es estrictamente distinto de `Tab Id`.
* **`código de cuenta`**: Referencia o número identificador de la cuenta o comanda operativa servida. En Last.app suele correlacionarse con `Tab Code`, pero en otros reportes agregados o bancarios su valor se indica como **`NO DISPONIBLE`**.
* **`número de factura`**: Correlativo oficial expedido de conformidad con la normativa de facturación de España para identificar el comprobante emitido al cliente (ej. `LI2-12`, `F-2026-01`). Si el ticket se conserva como cuenta sin fiscalizar, este campo figura como **`NO DISPONIBLE`**.
* **`identificador interno`**: Cadena o clave criptográfica originada de forma exclusiva por las plataformas externas de delivery (ej. Order UUID en Uber Eats o Código GL en Glovo). No existe coincidencia ni equivalencia matemática automática entre este identificador y los códigos de Last.app.
* **`posición de fila`**: Índice o renglón numérico absoluto que ocupa un registro digital dentro de una planilla o archivo de Excel al momento de su lectura por software parser.
* **`archivo de origen`**: Ruta relativa exacta, nombre del archivo y huella criptográfica SHA-256 del fichero digital sometido a importación en el Hub Económico.

---

## 5. Separación Formal entre Identidad de Fila y Candidato de Conciliación

Se diseñan dos mecanismos algorítmicos funcionalmente separados para evitar falsos rechazos en la carga de archivos:

### 5.1. Identidad de Fila Importada (Trazabilidad Interna de Carga)
Sirve única y exclusivamente para auditar la trazabilidad dentro de un proceso de importación y prevenir que el usuario cargue accidentalmente dos veces idéntico archivo de Excel.
* Utiliza los atributos transaccionales del fichero: **`archivo`**, **`hoja`**, **`posición`** (índice de renglón) y **`valores originales`** (hash del contenido crudo del renglón).
* Permite asegurar la inmutabilidad de lectura sin interferir con la lógica contable ni rechazar cuentas reabiertas o partidas.

### 5.2. Candidato a Mismo Ticket entre Archivos (Motor de Coincidencias)
Sirve para vincular, sugerir o detectar qué registros pertenecientes a archivos diferentes representan potencialmente la misma operación gastronómica o monetaria (por ejemplo, emparejar una fila del reporte de Uber Eats con un ticket del TPV de sala).
* Evalúa de forma combinada y flexible, **según disponibilidad**, los siguientes atributos transaccionales: **`ubicación`**, **`número de factura`**, **`fecha y hora`**, **`código de cuenta`**, **`fuente`**, **`total`**, **`canal`** y **`método de pago`**.
* **Prohibición arquitectónica:** Este mecanismo **no debe depender jamás de la posición de fila ni del nombre del archivo** para reconocer descargas solapadas o coincidencias transversales, ya que el orden de los renglones y la división de periodos varían arbitrariamente al exportar informes en semanas sucesivas.
* **No imposición de clave única definitiva:** El sistema se abstiene en esta etapa funcional de imponer una clave única definitiva y rígida entre archivos diferentes; emite sugerencias de candidato sujetas a revisión y verificación humana en el panel económico.
