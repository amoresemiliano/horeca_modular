# 18 - Integración y Conciliación Operativa de Delivery (Uber Eats y Glovo)

## 1. Contexto, Terminología y Objetivos Económicos

En la operativa diaria de **Taquería El Criollo**, una proporción sustancial de las ventas se canaliza mediante agregadores externos de comida a domicilio, en particular **Uber Eats** y **Glovo**. El tratamiento informático de estas plataformas exige un marco de especificación funcional riguroso que vincule los pedidos servidos por cocina con las liquidaciones periódicas transferidas a los extractos bancarios.

En obediencia estricta a la **Metodología Vegen Digital** y a los criterios de veracidad del **Control de Calidad (Fase 0.5)**, este documento rechaza aserciones dogmáticas y elimina por completo el uso de terminología de contabilidad oficial de libros mercantiles. Todo el análisis se articula bajo conceptos económicos de **movimiento económico, descuento, coste, comisión, ajuste, incidencia, clasificación, conciliación, dato fiscal informativo y preparación para gestoría**, prohibiendo la generación automática de imputaciones tributarias o balances con validez contable sin supervisión profesional humana.

> **NOTA DE LIMITACIÓN Y REGLA PROCESAL OBLIGATORIA:**
> Esta especificación técnica es exclusivamente documental.
> **NO se ha modificado código de software, NO se han escrito migraciones en base de datos, NO se han importado datos operativos, NO se han instalado dependencias de terceros, NO se ha ejecutado git commit ni push y NO se ha comenzado la Fase 2 de implementación.**

---

## 2. Archivos Reales Autorizados y Campos Verificados

Toda referencia técnica a la actividad de delivery en la taquería procede y se fundamenta exclusivamente en los archivos reales alojados en las subcarpetas autorizadas del espacio de trabajo: `reportes_elcriollo/Uber/` y `reportes_elcriollo/Glovo/`.

### 2.1. Inventario y Granularidad de Archivos de Uber Eats
1. **Reporte Detalle por Pedido:**
   * *Ruta verificada:* `reportes_elcriollo/Uber/5578cf56-c0a2-4cfa-aa27-68e29679f104-europe_middle_east_africa.csv`
   * *Granularidad:* Detallada a nivel de ítem y encargo gastronómico entregado al repartidor.
   * *Campos verificados por inspección:* Identificador del pedido (Order UUID), Fecha y hora del encargo, Total comercial bruta, Promociones co-financiadas, Tasas y comisiones retenidas en portal (Tasa de mercado / Service fee) y Saldo neto abonable al restaurante.
2. **Reporte Agregado de Liquidaciones:**
   * *Ruta verificada:* `reportes_elcriollo/Uber/1b9dc851-c6e8-49c8-84db-1c8ca0c01918-europe_middle_east_africa.csv`
   * *Granularidad:* Agregada y consolidada por lote de pago y transferencia bancaria periódica.
   * *Campos verificados:* Fecha del lote de pago, Identificador de liquidación de Uber Eats y Monto neto global encauzado al sistema bancario.
3. **Facturas Mercantiles de Intermediación (PDF):**
   * *Rutas verificadas:* `reportes_elcriollo/Uber/0298207f-0b72-5b79-aadf-c890a2f8827e_980f299e-eb49-5714-92b7-2d4cd465fbf7.pdf`, `reportes_elcriollo/Uber/7a7f4b23-f7c4-5e10-9ec6-b19f4503130f_a1f23358-6b9f-5e3c-bc70-d6c499822143.pdf`, `reportes_elcriollo/Uber/c8ad89ec-b213-56e9-b615-40c26ddc3959_eca098e4-5dad-5e81-8178-4893ef1c98c4.pdf`.
   * *Granularidad:* Documental por ciclo fiscal (semanal / mensual).
   * *Función operativa:* Soporte justificativo tributario emitido por Uber Eats B.V. documentando el importe total de las comisiones facturadas y los **datos fiscales informativos** relator al IVA soportado sobre el servicio de intermediación para la **preparación para gestoría**.

### 2.2. Inventario y Granularidad de Archivos de Glovo
1. **Reporte Detallado y Agregado en Excel:**
   * *Ruta verificada:* `reportes_elcriollo/Glovo/invoice-200112939041.XLSX`
   * *Granularidad:* Mixta (incluye pestaña de resumen consolidado y desglose de encargos servidos por el socio en el ciclo de cobro).
   * *Campos verificados:* Identificador del encargo en Glovo, Fecha de operación, Importe total bruta de alimentos, Coste por servicios de uso y comisión de plataforma, Ajustes logísticos, Impuestos asociados y Saldo neto abonable a Taquería El Criollo.
2. **Documento Justificativo Tributario (Factura PDF):**
   * *Ruta verificada:* `reportes_elcriollo/Glovo/Invoicing Document-200112939041.PDF`
   * *Granularidad:* Documental para el ciclo de facturación asociado (Factura #200112939041 de GlovoApp23 SL).
   * *Función operativa:* Respaldo legal e inmutable de los costes de marketing y logística retenidos por Glovo para ser entregados como **dato fiscal informativo** en el paquete mensual a la asesoría externa.

---

## 3. Componentes Económicos del Delivery

El análisis algorítmico en la capa del cliente SPA separa escrupulosamente cada registro de entrega en seis (6) magnitudes económicas independientes:

1. **Pedidos (Venta Bruta):** Valor económico total tarifado al consumidor final por los platillos y bebidas preparados en la cocina de la taquería. Constituye la partida principal de ingreso económico.
2. **Promociones (Descuentos):** Campañas de marketing, cupones de rebaja o iniciativas promocionales. El sistema documenta el descuento desglosando si fue financiado íntegramente por el restaurante o co-financiado entre el local y la plataforma de delivery.
3. **Comisiones (Coste del Agregador):** Cargo mercantil que la plataforma (Uber Eats o Glovo) deduce directamente del importe total del pedido por el servicio tecnológico de intermediación, captación de comensales y logística de reparto. Este concepto se tipifica en el Hub como **coste de intermediación comercial**.
4. **Ajustes (Incidencias y Mermas):** Deducciones retrospectivas o cargos extraordinarios aplicados por la plataforma debido a incidencias operativas de entrega (tardanzas, derrames en tránsito, artículos faltantes o reembolsos reclamados por clientes en la app).
5. **Impuestos Informativos:** Cuantías correspondientes al IVA soportado sobre la comisión comercial y el IVA repercutido del producto alimenticio. Se extraen exclusivamente como **datos fiscales informativos** destinados a facilitar la labor de comprobación de la gestoría contable externa, sin ejecutar cálculos tributarios automáticos con validez de autoliquidación.
6. **Neto (Saldo Liquidado):** Cifra final resultante de restar comisiones, descuentos co-financiados y ajustes retrospectivos a la venta bruta del pedido. Representa el derecho monetario exigible que el agregador adeuda e incorpora al posterior abono bancario.

---

## 4. Interrelación de Sistemas y Ausencia de Equivalencia Automática

Un hallazgo crítico del diagnóstico y control de calidad operado sobre las muestras reales del negocio es que **no existe una equivalencia automática unívoca ni una correspondencia inmediata columna a columna entre los sistemas origen** (`HECHO VERIFICADO POR NEGOCIO`). La arquitectura gestiona las relaciones transaccionales con base en las siguientes realidades operativas:

### 4.1. Relación con Last.app (Fuente de Venta y Cocina)
* Cuando una orden entra por mostrador o delivery en el TPV **Last.app**, el sistema genera un registro transaccional principal documentado en `reportes_elcriollo/Last.app/tabs-report-0.xlsx`, dotado de un **código de cuenta** local y un sello temporal al momento de preparación en sala.
* **Ausencia de Equivalencia Autónoma:** El identificador interno asignado por Uber Eats (ej. Order UUID) o por Glovo no coincide ni mantiene congruencia algorítmica con el `Tab Id` ni con el código de cuenta corto impreso en barra por Last.app. Asimismo, los tiempos de registro difieren de manera intrínseca: el TPV marca el momento en que la cocina acepta o expide el ticket, mientras que la plataforma puede registrar el timestamp en la solicitud del cliente o en la liquidación de entrega del repartidor.

### 4.2. Relación con el Banco (Extractos Sabadell y BBVA)
* Las transferencias monetarias acreditadas por Uber o Glovo en el Banco Sabadell o BBVA llegan como ingresos globales consolidados por lotes de liquidación (ej. abono de remesa semanal visible en `reportes_elcriollo/Uber/1b9dc851...csv` o `invoice-200112939041.XLSX`).
* El extracto bancario carece por completo de desglose por encargo de comida: únicamente certifica el hecho económico del **dinero acreditado** en la cuenta del titular, impidiendo conciliar línea a línea las ventas de cocina directamente contra el extracto sin una etapa intermedia de triangulación analítica.

---

## 5. Circuito Operativo y Estados de Conciliación

Para gestionar con transparencia las diferencias transaccionales entre las tres fuentes interdependientes sin inventar coincidencias artificiales, el **Motor de Conciliación Operativa (Nivel 2)** establece los siguientes estados normativos en la interfaz del gerente:

1. **`PENDIENTE_LIQUIDACIÓN`**: Estado atribuido a las ventas o lotes de delivery importados desde `tabs-report` para los cuales el Hub Económico aún no ha registrado la importación del reporte de liquidación del agregador ni el ingreso monetario compensatorio en el extracto bancario.
2. **`CONCILIADO_PARCIAL`**: Estado asignado cuando la suma bruta de ventas servidas por el TPV de sala coincide parcialmente con la liquidación neta del agregador, pero persisten discrepancias monetarias causadas por incidencias no justificadas, mermas logísticas pendientes de validar o desalineaciones temporales entre turnos consecutivios.
3. **`REQUIERE_REVISIÓN`**: Alerta directiva de alta prioridad. Se dispara de manera obligatoria cuando el analizador detecta deducciones unilaterales extraordinarias, ajustes por devoluciones retrospectivas en informes del agregador sin contraparte clara en cocina, o descuadres entre los netos bancarios y los cobros calculados. Exige la inspección y resolución expresa del usuario en sala.
4. **`CONCILIADO_TOTAL`**: Estado definitivo conferido cuando el gerente verifica satisfactoriamente la correspondencia entre: *(a)* el volumen bruto de órdenes servidas en Last.app, *(b)* el desglose contable de comisiones, promociones y ajustes en el volcado de Uber o Glovo, y *(c)* el abono efectivo transferido al extracto oficial de Sabadell o BBVA.

---

## 6. Configuración de Tolerancias y Limitaciones Operativas

En obediencia a las normas contra la invención de parámetros arbitrarios o supuestos no demostrados, se consagran dos reglas arquitectónicas inalienables relativas a tolerancias numéricas y plazos de compensación:

### 6.1. Prohibición de Inventar Porcentajes de Comisión o Ventanas Fijas de Fecha
**Queda terminantemente prohibido codificar de manera rígida o inventar porcentajes fijos de comisión** (tales como márgenes teóricos o fórmulas de deducción por defecto) o imponer **ventanas temporales fijas inamovibles** para el emparejamiento entre cortes semanales y abonos bancarios. Las condiciones tarifarias y calendarios de transferencia varían de forma dinámica según los contratos individuales firmados entre **Taquería El Criollo** y cada compañía tecnológica, y pueden modificarse por promociones temporales o variaciones geográficas.

### 6.2. Principio de Configuración por Análisis Histórico (`REQUISITO TÉCNICO`)
* Las tolerancias monetarias y los márgenes admisibles en la diferencia entre ventas y cobros netos **deben ser siempre parámetros configurables** dentro de la consola de administración de la plataforma (Pantalla 14: Configuración del Hub).
* Ninguna tolerancia de diferencia ni ventana elástica de fechas podrá activarse o darse por sentada de manera automática: **toda regla de tolerancia deberá ser expresamente revisada, validada y aprobada por el titular o gerente del negocio únicamente después de realizar un análisis exhaustivo del histórico de transacciones operadas en tienda**, preservando incólume el control humano y profesional sobre la salud financiera del establecimiento.
