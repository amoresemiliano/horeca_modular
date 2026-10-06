# 01 - Alcance del MVP y Fronteras Operativas

## 1. Definición del Producto Mínimo Viable (MVP)

El Producto Mínimo Viable del **Hub Económico-Financiero y Módulo de Extractos** se concibe como una herramienta transaccional consolidada que permite al equipo directivo de **Taquería El Criollo** recopilar, depurar, clasificar y visualizar integralmente los flujos de dinero del negocio en tiempo real. 

El objetivo primordial es erradicar la fragmentación entre los datos del banco, los cierres de caja en efectivo y los informes manuales en Excel, reemplazándolos por un panel de control operativo confiable sin alterar las dinámicas de cocina o barra.

---

## 2. Matriz de Alcance Funcional: Incluido vs. Excluido

Para gobernar el esfuerzo de desarrollo y evitar derivas procedimentales, se delinea con rigor analítico qué funcionalidades integran la primera entrega del sistema (MVP) y cuáles quedan postergadas o descartadas del camino crítico:

| Funcionalidad o Dominio | Estado en el MVP | Justificación Técnica y de Negocio | Etiqueta de Evidencia / Tipo de Decisión |
| :--- | :--- | :--- | :--- |
| **Importación de Extractos Bancarios** | `INCLUIDO EN MVP` | Carga manual web de ficheros en formatos CSV, `.xls` (BIFF8) y `.xlsx` para 2 cuentas BBVA, 1 tarjeta BBVA, 1 cuenta Sabadell y 1 tarjeta Sabadell. | `REQUISITO TÉCNICO` / `RECOMENDACIÓN` |
| **Adaptador de Reportes de Ventas (Last.app, Uber Eats, Glovo)** | `INCLUIDO EN MVP` | Módulo polimórfico de carga para reportes reales en libros Excel (**XLSX**), **CSV** y **PDF** procedentes del TPV Last.app y agregadores logísticos, estructurado tras la jerarquía **`LastReportAdapter`** (`LastXlsxAdapter` / `LastCsvAdapter`) según [17-addendum-reportes-tpv-delivery.md](./17-addendum-reportes-tpv-delivery.md). | `HECHO VERIFICADO POR NEGOCIO` / `REQUISITO TÉCNICO` |
| **Gestión de Movimientos Manuales** | `INCLUIDO EN MVP` | Formulario con registro de usuario, motivo, fecha y adjunto para cobros o gastos en efectivo, pagos excepcionales y ajustes de caja no bancarizados. | `REQUISITO TÉCNICO` |
| **Motor de Deduplicación en 3 Niveles** | `INCLUIDO EN MVP` | Implementación de Nivel A (Hash archivo), Nivel B (Trazabilidad fila) y Nivel C (Alerta de posible duplicado por importe y saldo sin bloqueo de cobros legítimos iguales). | `RECOMENDACIÓN` |
| **Clasificación por Reglas Deterministas** | `INCLUIDO EN MVP` | Ejecución en cliente/servidor de reglas configuradas por el usuario basadas en palabras clave de concepto, importe, banco o signo del movimiento. | `REQUISITO TÉCNICO` |
| **Nivel 1: Consolidación Económica** | `INCLUIDO EN MVP` | Tabla general y panel analítico que unifica ventas, cobros bancarizados y movimientos de caja en efectivo para visualizar el flujo real. | `REQUISITO TÉCNICO` |
| **Nivel 2: Conciliación Operativa (Básica)** | `INCLUIDO EN MVP` | Motor de sugerencias automáticas y vinculación manual con aprobación del usuario entre cobros en banco y liquidaciones de TPV o pedidos. | `DECISIÓN PROPUESTA` |
| **Panel Económico Preparatorio** | `INCLUIDO EN MVP` | Visualizaciones dinámicas de márgenes, concentración de gasto en proveedores y saldo total acumulado de caja por cuenta. | `REQUISITO TÉCNICO` |
| **Exportación Contable para Gestoría** | `INCLUIDO EN MVP` | Generación de paquetes en CSV y resúmenes normalizados mensuales de movimientos y comprobantes para envío al contable oficial. | `RECOMENDACIÓN` |
| **Sincronización Bancaria Automática** | `EXCLUIDO DEL MVP` | Conectores PSD2 / Open Banking mediante proveedores externos (ej. Nordigen, Tink) implican costes recurrentes y certificaciones que exceden esta fase. | `DECISIÓN HUMANA PENDIENTE` |
| **Conexión API en Vivo con Last.app** | `EXCLUIDO DEL MVP` | Al encontrarse el acceso a la API oficial en proceso sin formalizar ni aprobar en sala, se pospone la escucha por webhook o polling sincronizado al MVP 2. | `HECHO VERIFICADO` / `NO VERIFICABLE` |
| **Inteligencia Artificial Generativa (IA)** | `EXCLUIDO DEL MVP` | Los agentes IA para clasificar gastos ambiguos o responder consultas narrativas se proyectan a nivel arquitectónico, pero no operarán en el camino crítico. | `DECISIÓN PROPUESTA` |
| **Nivel 3: Contabilidad Oficial** | `EXCLUIDO DEL MVP` | La emisión de asientos oficiales del Plan General Contable (Debe/Haber), liquidaciones fiscales e impuestos no se codificarán dentro del Hub operacional. | `REQUISITO TÉCNICO` |
| **Lectura Inteligente de Comprobantes (OCR)**| `EXCLUIDO DEL MVP` | La extracción asistida por visión computacional sobre tickets en papel o facturas PDF subidas a la plataforma se pospone para futuras fases de servicio. | `RECOMENDACIÓN` |
| **Arquitectura Multi-Tenant (SaaS)** | `EXCLUIDO DEL MVP` | El código no requerirá separar múltiples empresas en esta entrega; funcionará como solución Single-Tenant cerrada y optimizada para Taquería El Criollo. | `HECHO VERIFICADO` / `REQUISITO TÉCNICO` |

---

## 3. Estrategia de Mitigación de Riesgos y Dependencias del MVP

Para salvaguardar la ejecución de esta primera versión operativa se establecen dos dependencias de control antes del inicio programado de la ingeniería transaccional en la **Fase 2 (Codificación)**:

1. **Dependencia de Parseo en Ficheros Binarios (`RIESGO CONDICIONAL`):**
   * *Diagnóstico:* Tal y como acreditó el control de calidad documental (Fase 0.5), PapaParse solo lee texto plano CSV.
   * *Mitigación en MVP:* La especificación técnica impone incorporar al paquete cliente una librería estándar capacitada para leer hojas de cálculo Microsoft Excel (`xlsx` o `exceljs`), sin cuya integración quedará inhabilitada la lectura de las 4 muestras de extractos bancarios del restaurante.
2. **Dependencia Nomenclatural en Insumos y Proveedores (`DECISIÓN HUMANA PENDIENTE`):**
   * *Diagnóstico:* La dispersión semántica verificada entre las tablas MySQL en cPanel/Bluehost (`EC_pedidos`) y los esquemas en la nube obliga a armonizar cómo el sistema identifica y reconcilia a un distribuidor HORECA.
   * *Mitigación en MVP:* El Hub introduce la entidad universal `contraparte` y vincula cada entrada bancaria y gasto manual de cocina mediante alias semánticos tolerantes a variaciones tipográficas ("Cta. Sabadell", "SAB", "BBVA MC"), posibilitando la consolidación sin reescribir de golpe el repositorio heredado en PHP/MySQL.
