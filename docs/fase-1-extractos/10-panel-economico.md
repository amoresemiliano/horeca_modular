# 10 - Panel Económico-Contable Preparatorio e Indicadores Directivos

## 1. Misión Directiva: Inteligencia Operativa sin Contabilidad Oficial

El **Panel Económico-Contable Preparatorio (`10-panel-economico.md`)** corona la arquitectura de la Capa Económica Común en el MVP, articulando un centro de inteligencia directivo y visual donde el titular del negocio y la gerencia de **Taquería El Criollo** pueden supervisar al minuto la rentabilidad, liquidez y cuentas por pagar de su restaurante.

> **ACLARACIÓN DIRECTIVA Y FISCAL DE LA INTERFAZ (`REQUISITO TÉCNICO`):**
> En acato irrestricto a los límites del dominio y normas de control de calidad, **esta interfaz no constituye, declara ni reemplaza la contabilidad oficial tributaria del establecimiento**, ni suplanta la labor jurídica o fiscal de los profesionales externos o libros oficiales de Debe y Haber del Plan General Contable. Su objetivo es preparar, clarificar, consolidar e ilustrar los balances reales de la sala para la toma de decisiones ágiles en almacenes e informar los reportes limpios al contable.

---

## 2. Catálogo Dimensional del Panel de Control Directivo

La interfaz del panel agrupará y desplegará transaccional mediante tarjetas dinámicas, gráficos comparativos de alto rendimiento y tablas interactivas de desglose en la SPA la siguiente matriz de indicadores:

| Indicador Directivo de Sala | Fuentes Relacionadas en Base de Datos | Descripción y Aporte al Control de Negocio en la Restauración |
| :--- | :--- | :--- |
| **1. Ingresos Reales** | `MOVIMIENTOS_ECONOMICOS` (Signo Ingreso) | Sumatorio total transaccional consolidado de abonos verificados entrando al negocio vía cuentas bancarias (BBVA/Sabadell), terminales TPV en sala y depósitos de efectivo en caja. |
| **2. Gastos Operativos** | `MOVIMIENTOS_ECONOMICOS` (Signo Gasto) | Cómputo global consolidado del egreso dinerario real saliendo por cuentas corrientes del banco, tarjetas de crédito, gastos manuales por caja y adelantos al personal de sala. |
| **3. Saldo Total y por Cuenta**| `CUENTAS_FINANCIERAS` (Saldo Actual) | Fotografía en tiempo real de la liquidez patrimonial consolidada disponible en tienda, fraccionable al detalle por instrumento monetario (Cta. Sabadell, Tarj. BBVA, Caja Sala, Pasarelas). |
| **4. Flujo de Caja (Cashflow)**| Balances de Ingreso menos Gasto | Gráfico evolutivo cronológico ilustrando la curva de liquidez decreciente o creciente en la semana y el mes para prevenir tensiones temporales de caja o roturas en pagos transaccionales a terceros. |
| **5. Gastos por Categoría** | `CATEGORIAS` ↔ `MOVIMIENTOS_ECONOMICOS`| Desglose gráfico en pastel o barras indicando el porcentaje real de los desembolsos absorbidos por grandes líneas (Materia Prima Gastronómica, Personal, Alquiler, Suministros). |
| **6. Gastos por Subcategoría**| `SUBCATEGORIAS` ↔ `MOVIMIENTOS_ECONOMICOS`| Zoom de alta precisión analítica indicando presiones de coste específicas y desviaciones granulares en la cocina (ej. evolución del gasto en *"Carnes y Aves"* o *"Bebidas"*). |
| **7. Gastos por Contraparte** | `CONTRAPARTES` ↔ `MOVIMIENTOS_ECONOMICOS`| Ranking interactivo con los mayores receptores de capital de la empresa (mayoristas alimentarios de `EC_pedidos`, comisionistas TPV o servicios públicos de tienda). |
| **8. Ventas Brutas y TPV** | `VENTAS_TPV` (Importaciones CSV / API) | Suma monetaria en bruto de las comandas y tickets cobrados o emitidos desde las consolas de servicio en barra y mesas operadas mediante `Last.app`. |
| **9. Ventas por Canal** | `VENTAS_TPV.canal_venta` | Comparativa estratégica segmentando las preferencias de consumo: facturación por mesas en Comedor y Terraza frente al peso de las órdenes para llevar y delivery exterior (Glovo/Uber). |
| **10. Efectivo y Caja Sala** | Cuenta interna (`Caja Sala`) | Monitorización en línea del metálico cobrado, gastos informales abonados en mano y saldo de billetes pendiente de ser depositado por ventanilla al banco. |
| **11. Liquidaciones Agrupadas**| Entidad `cierre_tpv` en BD | Listado de remesas bancarizadas consolidadas de cobros con tarjetas de débito/crédito esperando o confirmadas en conciliación al día posterior de su venta al público. |
| **12. Comisiones Retenidas** | `CONCILIACIONES_OPERATIVAS.comision` | Cómputo monetario exacto del impacto de sobrecoste financiero ocasionado en el mes por tasas del datáfono y descuentos comerciales retenidos por plataformas de delivery. |
| **13. Pagos Pendientes** | Facturas de `EC_pedidos` sin conciliar | Alerta temprana sobre deudas vivas con distribuidores de insumos o servicios que no evidencian aún apunte saliente en las cuentas bancarias o de efectivo del establecimiento. |
| **14. Sin Clasificar / Alertas**| Movimientos en `PENDIENTE` o `REVISIÓN`| Contador en rojo encendiddo notificando al administrador cuántos apuntes nuevos recién importados requieren verificación o aplicación de regla determinista por la tienda. |
| **15. Sin Conciliar / Sueltos** | Asientos con `NO_CONCILIADO` en Nivel 2 | Registro transaccional auditando cuántos cobros del banco o de almacenes persisten navegando en la plataforma sin vincular a su correspondiente factura o ticket del TPV. |
| **16. Compras sin Pago** | Pedidos de Almacén pendientes en Nivel 2 | Inventario de compromisos de abono encargados por el cocinero en el almacén con proveedores que figuran como entregados por cocina pero en pie de abono pendiente en caja. |
| **17. Ventas sin Cobro** | `VENTAS_TPV` en `"PENDIENTE_COBRO"` | Control exhaustivo sobre cuentas abiertas corporatives, reservas de eventos para empresas en sala o facturas que no reflejan acreditado ingreso dinerario en el banco. |
| **18. Evolución Mensual** | Históricos agregados por Mes/Año | Contrastación paralela de rendimiento financiero mes sobre mes en el restaurante para evaluar temporadas de mayor afluencia HORECA. |
| **19. Variaciones y Desvíos**| Delta interperiodal en % y Euros | Cálculo algorítmico alertando si el coste del litro de aceite o el gasto en comisiones bancarias del mes supera en exceso la media del semestre previo. |
| **20. Concentración Proveedores**| Ratio de Gasto por `PROVEEDOR` | Gráfico de riesgo operativo identificando la dependencia estratégica frente a mayoristas específicos del menú (ej. si un carnicero concentra el 45% del desembolso transaccional). |
| **21. Costes Fijos vs Variables**| Configuración taxonómica en `CATEGORIAS`| Segregación analítica separando gastos inalterables de estructura (Alquiler, Gestoría, Seguros) del gasto variable directamente proporcional al volumen de platillo servidos (Carne, Bebidas, Luz). |
| **22. Impuestos Identificados**| Cuotas IVA estimadas en TPV/Bancos | Totalizador preparatorio e informativo acumulando el IVA repercutido en sala y el soportado en compras verificables del almacén aplicadas por el sistema para orientar la tesorería de la empresa. |
| **23. Financiación y Crédito**| Contraparte tipo `FINANCIACIÓN` | Monitorización del coste bancario, intereses o líneas de crédito de confirming utilizadas por el restaurante para dinamizar el pago a distribuidores en almacén. |
| **24. Movimientos Internos** | Contraparte tipo `CUENTA_PROPIA` | Trazabilidad transparente de los traspasos, retiros de efectivo y depósitos bancarios de caja a caja, asegurando que sumen exactamente cero euros en el balance general contable del establecimiento. |

---

## 3. Código Semántico de Calidad y Certeza en el Dato (`REQUISITO TÉCNICO`)

Para erradicar falsas percepciones directivas al inspeccionar la información contable o tomar decisiones de compra urgentes, la interfaz del Panel Económico incorporará un código semántico visual de cuatro colores y distintivos que acompañará inexorablemente a toda métrica, cifra o sumatorio exhibido al administrador titular:
1. `DATO CONFIRMADO` *(Verde / Check)*: Cifra verificada con plena suficiencia relacional en sala; procede de una línea bancarizada conciliada o de una clasificación aprobada por el gerente de turno e inmutable ante borrado físico.
2. `DATO ESTIMADO` *(Azul / Info)*: Cifra proyectada por el motor basándose en cálculos aritméticos orientativos del TPV (ej. las comisiones bancarias o tasas del datáfono calculadas sobre el CSV antes de recibir en cuenta el apunte definitivo del banco al día siguiente).
3. `DATO PENDIENTE` *(Amarillo / Alerta)*: Cifra vinculada a una transacción operativa documentada que espera una acción humana próxima para consolidarse en pie de caja (ej. una orden de compra o pedido encarnado en `EC_pedidos` pendiente del depósito bancario de pago en tienda).
4. `DATO INCOMPLETO` *(Naranja-Rojo / Exclamación)*: Cifra o bloque analítico cuya información adolece de vacíos transaccionales en su ingesta (ej. un extracto bancario mensual donde subsisten apuntes transitorios sin beneficiario claro, o un movimiento manual sin subcategoría obligatoria designada).
