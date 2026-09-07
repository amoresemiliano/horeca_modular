# 02 - Mapa Funcional y Estado del Ecosistema

## 1. Metodología de Mapeo y Criterio Estricto de Evaluación

El presente documento detalla el estado funcional verificable de todas las capas, carpetas y aplicaciones del ecosistema `el-criollo-ecosistema/`. Para garantizar la fiabilidad del diagnóstico frente a la toma de decisiones, se aplica el **Criterio Funcional Estricto de la Metodología Vegen Digital SL**:

> **CRITERIO FUNCIONAL ESTRICTO:** Un módulo web o componente visual no puede clasificarse como funcional en un entorno de producción cooperativo ni corporativo si su capa de persistencia de datos se sustenta en exclusividad sobre el almacenamiento temporal en el cliente (`localStorage`) o sobre datos estáticos simulados en memoria (Mocks / Stubs).

En función de este criterio y de la **Regla de Evidencia** del control de calidad, los estados operativos se tipifican formalmente entre:
* **Producción Activa (Legacy / Independiente):** Código en servidor dedicado (PHP/MySQL o Node.js) operativo para operaciones diarias verificables.
* **Desarrollo / MVP Frontend (localStorage):** Interfaz implementada cuya persistencia reside en el navegador local, incompatible con trabajo concurrente o sincronización entre dispositivos sin refactorizar su conexión web.
* **Mock Visual / Prototipo:** Interfaz o componente renderizado con estructuras fijadas estáticamente en el código sin persistencia ni llamadas a backend web.
* **Inconcluso / En Integración:** Módulo con interfaz conectada experimentalmente a conectores REST o Supabase pero con flujos de importación o validación incompletely implementados.

---

## 2. Matriz de Estado Operativo Verificado

| Módulo / Repositorio | Carpeta en Workspace | Tecnología Principal (`HECHO VERIFICADO`) | Persistencia Observada (`HECHO VERIFICADO`) | Estado Operativo Real (`INFERENCIA` / `VERIFICADO`) | Compatibilidad Futura Multi-Tenant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pedidos (Operativa Real)** | `pedidos/` (`EC_pedidos`) | JS Vanilla, PHP 7+, MySQL | MySQL (`athcomar_comprasWS`) | **Producción Activa (Legacy):** Conectado al despacho diario mediante WhatsApp Web (`wa.me`). | `INFERENCIA`: Requiere diseño de segmentación por inquilinos y adaptación de backend en fase posterior. |
| **Pedidos (SPA Maestra)** | `el_criollo_modular/src/modules/pedidos/` | React 19, Tailwind CSS | Array estático (`useState`) | **Mock Visual:** Prototipo desconectado sin lógica transaccional, servidor ni persistencia. | `INFERENCIA`: Pendiente de desarrollo transaccional y diseño arquitectónico relacional. |
| **Extractos (SPA Maestra)** | `el_criollo_modular/src/modules/extractos/` | React 19, PapaParse | Cliente Supabase REST (`extractos`) | **En Integración:** Lógica de carga CSV operando en cliente con PapaParse. | `NO VERIFICABLE`: Falta inspección DDL de Supabase; requiere añadir columna de inquilino en diseño futuro. |
| **Extractos (Prototipo JS)** | `extractos/` (`EC_extractos`) | HTML, JS Vanilla | Ninguna (Carga temporal CSV) | **Prototipo Histórico:** Banco de pruebas previo a la absorción en la plataforma React. | `NO VERIFICABLE` |
| **Inventario (SPA Maestra)** | `el_criollo_modular/src/modules/inventario/` | React 19, Zustand / Reducers | `window.localStorage` | **Desarrollo / MVP Frontend:** Lógica de almacén funcional localmente, sin persistencia nube. | `INFERENCIA`: Requiere sustituir los reducers locales por tablas relacionales remotas. |
| **Inventario (Sistema Legacy)** | `inventario/` (`EC_inventario`) | PHP, React, MySQL | MySQL (`athcomar_inventario`) | **En Integración Legacy:** Proyecto intermedio independiente provisto de tablas SQL sin FKs inyectadas. | `INFERENCIA`: Pendiente de decisión sobre unificación de esquemas con catálogo central. |
| **Integración TPV y BCG** | `last_API/` | Node.js, Express, Socket.IO | MySQL (`athcomar_vegen_Last_API`) | **Producción / Servicio Analítico:** Motor WebSocket para TPV y cálculo contable de Matriz BCG. | `INFERENCIA`: Capa lógica aisable por negocio en futuras refactorizaciones de backend. |
| **Escandallos / Recetas** | `escandallos/` (`EC_escandallos`) | JS Vanilla, HTML | `localStorage` | **Mock / Prototipo:** Herramienta visual aislada diseñada para el cálculo de costos gastronómicos (ej. guacamole). | `NO VERIFICABLE` |
| **KPIs & Business Intel.** | `kpis/` (`EC_kpis`) | Chart.js, HTML, JS | Importación manual CSV en sesión | **Mock Visual / Prototipo:** Interfaz de gráficas que requiere cargar datos manualmente desde ficheros al inicio de sesión. | `NO VERIFICABLE` |
| **Predicción & Sugerencias** | `prediccion/` (`EC_prediccion`) | HTML, Tailwind, JS | Estático / Simulación | **Mock Visual / Prototipo:** Maqueta conceptual sin motor de cálculo analítico de IA integrado. | `NO VERIFICABLE` |
| **Horarios / Jornadas (SPA)** | `el_criollo_modular/src/modules/horarios/` | React 19 | Cliente Supabase (`empleados`, `fichajes`) | **En Integración:** Interfaces conectadas mediante consultas libres al cliente de base de datos nube. | `NO VERIFICABLE`: Estado de aislamiento RLS y permisos del motor remor dependiente del DDL. |

---

## 3. Análisis de Discrepancias por Dominio Operativo

### 3.1. Dominio de Pedidos y Compras
* **Evidencia Acreditada (`HECHO VERIFICADO`):** La operación de cocina y almacén del restaurante se respalda en el código de `pedidos/app.js`, donde se opera un catálogo multi-proveedor utilizando `TomSelect` e invocando al script PHP `orders.php`.
* **Evaluación Directiva (`INFERENCIA` / `RECOMENDACIÓN`):** El módulo React `PedidosApp.jsx` no cuenta todavía con los componentes lógicos para suplir el servicio en activo. En acato al objetivo inmediato del negocio, no debe desconectarse la herramienta de PHP hasta alcanzar paridad funcional comprobada mediante pruebas paralelas y aceptación de usuario.

### 3.2. Dominio del Inventario de Almacén
* **Evidencia Acreditada (`HECHO VERIFICADO`):** El gestor de estado en la aplicación principal (`el_criollo_modular/src/modules/inventario/store.jsx:L104`) envuelve sus depósitos en un hook llamado `usePersistedState`, el cual realiza lecturas y escrituras sincrónicas contra el almacén local del navegador (`localStorage`).
* **Evaluación Directiva (`RIESGO CONDICIONAL`):** Si un operario introduce las mermas o recepciones del almacén en su dispositivo web, dichos registros son inaccesibles desde el terminal del jefe de sala o de contabilidad, y están expuestos a borrado en caso de limpieza del historial web. La migración progresiva a un backend de persistencia compartida es un requisito técnico indispensable para la estabilidad del local titular.

### 3.3. Dominio de Extractos Contables
* **Evidencia Acreditada (`HECHO VERIFICADO`):** En `el_criollo_modular/src/modules/extractos/ImportModal.jsx` y `ExtractosApp.jsx`, el importador se basa en `Papa.parse` de la librería PapaParse para transformar texto CSV y transferir hileras al método `@supabase/supabase-js`.
* **Evaluación Directiva (`RECOMENDACIÓN`):** Para convertir este módulo en un MVP robusto para Taquería El Criollo (Fase 1 y 2), la ingeniería deberá diseñar un esquema funcional verificable y prever la ingesta estructurada sin bloquear erróneamente movimientos bancarios coincidentes en la jornada.
