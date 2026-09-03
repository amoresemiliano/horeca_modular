# Auditoría Canónica — HORECA Modular Actual

> Documento oficial de diagnóstico, inventario de módulos, evaluación de arquitectura, permisos, integración con Supabase y propuesta de consolidación como **Entorno Único y Canónico del Producto HORECA Modular**.
>
> **Estado**: COMPLETADO (Reauditado con acceso SUPERADMIN)  
> **Repositorio canónico**: `amoresemiliano/horeca_modular`  
> **URL desplegada**: `https://horecamodular.vercel.app/`  
> **Backend de Staging**: Supabase (`horeca_modular_staging` / Ref: `ourzapkjykzlwsjunzmd`)

---

## 1. SUPERADMIN FUNCTIONAL REAUDIT (Segunda Pasada)

### Contexto de Evaluación y Autenticación:
- **Primera pasada**: Navegación con usuario `vegendigital@gmail.com`. Al no estar definido explícitamente en la matriz de permisos hardcodeada del sistema, el fallback restringió su visibilidad únicamente al módulo `Bancos`.
- **Segunda pasada (Reauditoría Canónica)**: Autenticación completa con **`emilianodirosa1@gmail.com`**, usuario configurado como **SUPERADMIN** con acceso total a los **11 módulos** y todas sus pestañas/subvistas.

```text
FIRST_AUDIT_USER: vegendigital@gmail.com
FIRST_AUDIT_ACCESS: RESTRICTED (Fallback a solo 'Bancos')

SECOND_AUDIT_USER: emilianodirosa1@gmail.com
SECOND_AUDIT_ACCESS: SUPERADMIN (Acceso total 11 módulos)
```

---

## 2. Principio y Objetivo de la Auditoría

El objetivo central de esta reauditoría es **verificar en profundidad la funcionalidad real desplegada en Vercel (SHA `30dfba7`)** con permisos de administración total y distinguir estrictamente entre:
1. **Lo que está actualmente desplegado y funcional en Vercel (SHA `30dfba7`)**.
2. **Lo desarrollado e implementado en ramas de características pendientes de integración**:
   - `feature/extractos` (SHA `53b2d8d` - Track A Antigravity).
   - `feature/escandallos` (SHA `2b3ac583f83e416576f60d0cf377c775772535e0` - Track B Jules).

Se ratifica el principio de **UN SOLO HORECA MODULAR** en `https://horecamodular.vercel.app/`.

---

## 3. Inventario Completo de Navegación y Pantallas (Segunda Pasada SUPERADMIN)

| Área | Módulo | Pestañas / Subvistas | Clasificación Funcional (Deploy `30dfba7`) | Backend / Persistencia | Observaciones en Deploy Vercel |
|---|---|---|---|---|---|
| **Strategy** | Digital Presence Map | Strategy | `UI_ONLY` | Mock local (`MOCK_CHANNELS`) | Mapa de nodos de presencia digital con leyenda y drawer de acciones. |
| **Finanzas** | Bancos / Extractos | Consolidado, Resumen, Gráficas | `FUNCTIONAL_READ_ONLY` / `PARTIAL` | Supabase / State local | Ingesta y visualización de movimientos. *(Track A completo con 5 parsers, deduplicación y PyG listo en branch `feature/extractos`)*. |
| **Finanzas** | Ventas | Productos, Gráficos, Tickets, Mesas | `PARTIAL` | PapaParse / CSV local | Ingesta de CSV de TPV en memoria. Visualización de tickets por zona y comensales. |
| **Finanzas** | KPIs | Dashboard, Carga Datos | `UI_ONLY` | Mock / Local | Tarjetas de resumen a 0,00 € y cajas de subida CSV (Ventas, Tickets, Comensales, Productos). |
| **Operaciones** | Compras | Orden, Historial | `PARTIAL` | State local (`useState`) | Generador de pedidos con selección de proveedor, mermas, impuestos 10%, botón WhatsApp y 3 pedidos mock en historial. |
| **Operaciones** | Escandallos | Preparaciones, Platos, Productos | `PARTIAL` | State local (`useState`) | Constructor de escandallos con cálculo de merma %, coste receta, precio sugerido y % food cost. *(Modelado DB relacional completo en branch `feature/escandallos`)*. |
| **Operaciones** | Producción | Registro, Historial, Resumen | `FUNCTIONAL_PERSISTENT` | **Supabase Staging** (`produccion_registros`) | **Persistencia real**: Registro diario de lotes de cocina, mermas, turnos, responsables y ranking acumulado por producto. |
| **Operaciones** | Inventario | Dashboard, Inventario, Producción, Movimientos, Planificación | `PARTIAL` | Local Store (Zustand/State) | Control de stock por sede (Palencia, Vallecas) con edición en memoria. |
| **Personal** | Personal | Fichajes, Incidencias, Empleados, Informes | `FUNCTIONAL_PERSISTENT` | **Supabase Staging** (`empleados`, `fichajes`, `incidencias`) | **Persistencia real**: Fichajes (RD-ley 8/2019), cálculo de horas netas, pausas, bajas/vacaciones e informe acumulado mensual. |
| **Analytics** | Predicción | Carga, Stock, Predicciones | `MOCK` | Mock local | Proyección de pedidos basada en simulación de stock mínimo e histórico. |
| **Sistema** | Configuración | Accesos, Empresa, Usuarios | `UI_ONLY` | Local State | Vistas base de configuración de empresa y usuarios. |

---

## 4. Auditoría Exhaustiva de Módulos Prioritarios

### 4.1 Módulo de Compras (Prioridad Alta)
- **Estado en Deploy Vercel (SHA `30dfba7`)**: `PARTIAL`.
- **Análisis de Vistas**:
  - **Pestaña `Orden`**: Permite elegir proveedor (Carnicería Carlos, Bebidas Premium, Frutas Ruiz), fecha de entrega, añadir filas de insumos (Entrecot, Pollo, etc.), definir kg y precio unitario en €, calcula automáticamente subtotal, impuestos (10%) y total. Incluye campo de observaciones y botón para formatear el mensaje hacia WhatsApp del proveedor.
  - **Pestaña `Historial`**: Tabla interactiva con 3 pedidos hardcodeados (#1 Carnicería Carlos 150.50€, #2 Bebidas Premium 320.00€, #3 Verduras Frescas 85.20€).
- **Comparativa con Sistema Legacy (`vegendigital.com/sistemas/comprasWS/`)**:
  - `comprasWS` opera diariamente con un catálogo de proveedores relacional y persistencia en MySQL/PHP.
  - **Dictamen de Clasificación**:
    - `KEEP_HUB`: Mantener la UI/UX moderna del AppShell de HORECA Modular.
    - `PORT_FROM_COMPRASWS`: Migrar el esquema de tablas de proveedores, productos e insumos a Supabase.
    - `REFACTOR`: Conectar las líneas de compra directamente con el catálogo de insumos de Escandallos e Inventario.

### 4.2 Módulos de Producción e Inventario (Prioridad Alta)
- **Producción (`ProduccionApp.jsx`)**:
  - **Estado**: `FUNCTIONAL_PERSISTENT`.
  - **Evidencia Supabase**: Conectado directamente a la tabla `produccion_registros` de `horeca_modular_staging`.
  - **Funcionalidad real**: Lee y escribe lotes producidos por fecha, turno (Mañana/Tarde/Noche), cantidad, unidad (kg/L/porciones), merma y responsable vinculado a la tabla `empleados`. El resumen calcula el % de merma acumulado por producto.
- **Inventario (`InventarioApp.jsx`)**:
  - **Estado**: `PARTIAL`.
  - **Funcionalidad**: Control visual de stock por sede (Palencia, Vallecas), planificación y movimientos. Actualmente opera sobre estado en memoria.
  - **Plan de Acoplamiento**: En la siguiente fase, la confirmación de un lote en Producción descontará automáticamente las existencias en Inventario.

### 4.3 Módulo de Personal
- **Estado**: `FUNCTIONAL_PERSISTENT`.
- **Evidencia Supabase**: Operativo sobre 3 tablas en Supabase Staging:
  - `empleados`: `id`, `nombre`, `apellidos`, `nif`, `email`, `cargo`, `fecha_alta`, `activo`.
  - `fichajes`: `id`, `empleado_id`, `fecha`, `hora_entrada`, `hora_salida`, `minutos_pausa`, `horas_trabajadas`, `tipo` (ordinario, festivo, nocturno, guardia), `notas`.
  - `incidencias`: `id`, `empleado_id`, `tipo` (Baja médica, Vacaciones, Permiso, Ausencia), `fecha_inicio`, `fecha_fin`, `descripcion`, `resuelto`.
- **Verificación**: Cumple con la normativa RD-ley 8/2019. Permite dar de alta empleados, fichar entradas/salidas con deducción de pausas, registrar bajas médicas y generar informes de horas mensuales.

---

## 5. Auditoría Separada de Ramas de Características (Extractos y Escandallos)

Para evitar declaraciones erróneas sobre lo desplegado en Vercel vs lo desarrollado localmente:

### Módulo Extractos & PyG
- **DEPLOYED_EXTRACTOS_STATUS** (SHA `30dfba7` en Vercel): `FUNCTIONAL_READ_ONLY` / `PARTIAL`.
- **FEATURE_BRANCH_EXTRACTOS_STATUS** (Branch `feature/extractos` - SHA `53b2d8d`): **`FUNCTIONAL_PERSISTENT_TRACK_A`**.
  - *Detalle*: Parser de 5 extractos bancarios reales (BBVA MC, BBVA MT, BBVA Tarjeta, Sabadell Cta, Sabadell Tarjeta), deduplicación Nivel A/B/C, 4 tablas Supabase (`eco_financial_movements`, `eco_movement_allocations`, `eco_financial_accounts`, `eco_classification_rules`), modal de splits, soft delete, motor de reglas y PyG dinámico (`ExtractosResumen.jsx`). 22/22 tests unitarios pasando.

### Módulo Escandallos
- **DEPLOYED_ESCANDALLOS_STATUS** (SHA `30dfba7` en Vercel): `PARTIAL`.
  - *Detalle*: Interfaz visual de receta, ingredientes, mermas % y costes en memoria.
- **FEATURE_BRANCH_ESCANDALLOS_STATUS** (Branch `feature/escandallos` - SHA `2b3ac583f83e416576f60d0cf377c775772535e0` por Jules): **`FUNCTIONAL_PERSISTENT_FEATURE_BRANCH`**.
  - *Detalle*: Modelo relacional de recetas anidadas en Supabase (`escandallos`, `escandallo_ingredientes`), cálculo dinámico de costes e integración con productos.

---

## 6. Matriz de Datos Reales y Backend por Módulo

| Módulo | Backend | Tabla / API Supabase | Read | Write | Persistencia | Datos Real / Mock |
|---|---|---|---|---|---|---|
| **Bancos / Extractos** | Supabase | `eco_financial_movements`, `eco_movement_allocations`, `eco_financial_accounts`, `eco_classification_rules` | SÍ | SÍ | Persistente | **REAL** (en branch `feature/extractos`) |
| **Personal** | Supabase | `empleados`, `fichajes`, `incidencias` | SÍ | SÍ | Persistente | **REAL** (desplegado) |
| **Producción** | Supabase | `produccion_registros`, `empleados` | SÍ | SÍ | Persistente | **REAL** (desplegado) |
| **Escandallos** | Supabase | `escandallos`, `escandallo_ingredientes` | SÍ | SÍ | Persistente | **REAL** (en branch `feature/escandallos`) |
| **Compras** | Local State | *Pendiente crear `compras`* | SÍ | NO | En memoria | Mock / UI |
| **Inventario** | Local Store | *Pendiente crear `inventario_items`* | SÍ | NO | En memoria | Mock / UI |
| **Ventas** | Memory / PapaParse | *CSV Upload* | SÍ | NO | En memoria | Mock / CSV |
| **KPIs / Predicción** | Memory | N/A | SÍ | NO | En memoria | Mock |

---

## 7. Análisis de Autenticación Legacy y Autorización Hardcodeada

### Definición Actual en Código (`src/components/MainLayout.jsx` L34-38):
```javascript
const PERMISOS = {
  'emilianodirosa1@gmail.com': MODULOS.map(m => m.id),
  'epalacios1194@gmail.com':   ['Compras', 'Personal'],
};
```

### Comportamiento de Autorización:
- **Autenticación**: Manejada vía Firebase Auth (`GoogleAuthProvider`).
- **Autorización**: `PERMISOS[user?.email] ?? ['Bancos']`.
- **Fuga de Alcance en Auditoría Anterior**: Como `vegendigital@gmail.com` no estaba en la constante `PERMISOS`, el sistema ejecutó la regla fallback dando acceso únicamente al módulo `Bancos`.
- **Estrategia de Migración a `Supabase Auth`**:
  - Reemplazar `firebaseConfig.js` por `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - Crear la tabla `eco_user_profiles` (`id`, `auth_user_id`, `email`, `organization_id`, `role`).
  - Asignar el rol `SUPERADMIN` a `emilianodirosa1@gmail.com` en base de datos, eliminando la matriz hardcodeada en el frontend.

---

## 8. Reevaluación del AppShell y Adaptabilidad Mobile

### AppShell: `KEEP_WITH_REFINEMENTS`
- El AppShell actual de HORECA Modular es altamente robusto, con excelente navegación por grupos (`Strategy`, `Finanzas`, `Operaciones`, `Personal`, `Analytics`, `Sistema`), colapsabilidad fluida y rendimiento óptimo.

### Evaluación en Dispositivos Móviles (Viewport 375px - 430px):
- **Compras**: Formularios responsive en 1 columna. Las tablas de productos e historial requieren scroll horizontal.
- **Producción**: Tarjetas KPI y modales adaptados.
- **Personal / Fichajes**: Formulario de fichaje 100% usable en móvil. Tablas anchas usan `overflow-x-auto`.
- **Extractos**: Listado de movimientos utilizable con scroll lateral.
- **Escandallos**: Resumen financiero adaptable en tarjeta vertical.
- **Dictamen**: `RESPONSIVE_STATUS`: `DESKTOP_EXCELENTE_MOBILE_MEDIO`.

---

## 9. Correcciones respecto de la Primera Pasada

1. **Personal y Producción**: En la primera pasada no se pudo certificar la persistencia completa de Producción y Personal debido a las restricciones de vista del usuario secundario. En esta reauditoría con SUPERADMIN se confirma que **ambos módulos leen y escriben datos reales en Supabase Staging**.
2. **Extractos y Escandallos**: Se separa explícitamente lo que está subido en el deploy Vercel SHA `30dfba7` de las implementaciones avanzadas listas en las ramas de características (`feature/extractos` y `feature/escandallos`).
3. **Compras**: Se auditó el generador de pedidos y se estableció la estrategia de migración desde `comprasWS` sin destruir la UI del Hub.

---

## 10. Cierre Obligatorio y Dictamen Canónico Final

```text
FIRST_AUDIT_USER: vegendigital@gmail.com
FIRST_AUDIT_ACCESS: RESTRICTED
SECOND_AUDIT_USER: emilianodirosa1@gmail.com
SECOND_AUDIT_ACCESS: SUPERADMIN

DEPLOY_URL: https://horecamodular.vercel.app/
DEPLOY_BRANCH: dev
DEPLOY_SHA: 30dfba7

CANONICAL_APPSHELL: KEEP_WITH_REFINEMENTS

MODULES_FOUND: 11
FUNCTIONAL_PERSISTENT: 2 (Personal, Producción)
FUNCTIONAL_READ_ONLY: 1 (Bancos/Extractos base)
PARTIAL: 4 (Compras, Inventario, Escandallos base, Ventas)
UI_ONLY: 3 (Presence, KPIs, Config)
MOCK: 1 (Predicción)
BROKEN: 0

PURCHASES_DEPLOYED_STATUS: PARTIAL
PRODUCTION_DEPLOYED_STATUS: FUNCTIONAL_PERSISTENT
INVENTORY_DEPLOYED_STATUS: PARTIAL
PERSONAL_DEPLOYED_STATUS: FUNCTIONAL_PERSISTENT

DEPLOYED_EXTRACTOS_STATUS: FUNCTIONAL_READ_ONLY
FEATURE_BRANCH_EXTRACTOS_STATUS: FUNCTIONAL_PERSISTENT_TRACK_A (SHA 53b2d8d)

DEPLOYED_ESCANDALLOS_STATUS: PARTIAL
FEATURE_BRANCH_ESCANDALLOS_STATUS: FUNCTIONAL_PERSISTENT_FEATURE_BRANCH (SHA 2b3ac583)

KPIS_STATUS: UI_ONLY
METRICS_STATUS: UI_ONLY
PREDICTION_STATUS: MOCK
OCR_STATUS: MISSING_IN_HUB

AUTH_IMPLEMENTATION: FIREBASE_AUTH (Google Provider)
AUTHORIZATION_IMPLEMENTATION: HARDCODED_IN_MAINLAYOUT (PERMISOS object)
HARDCODED_ACCESS_RULES: PERMISOS[user?.email] ?? ['Bancos']
SUPABASE_AUTH_MIGRATION_IMPACT: ELIMINATES_HARDCODED_RULES_AND_ADDS_DB_RLS

REAL_DATA_MAP:
  - Personal -> Supabase (empleados, fichajes, incidencias)
  - Producción -> Supabase (produccion_registros, empleados)
  - Extractos (Branch feature/extractos) -> Supabase (eco_financial_movements, eco_movement_allocations, eco_financial_accounts, eco_classification_rules)
  - Escandallos (Branch feature/escandallos) -> Supabase (escandallos, escandallo_ingredientes)

RESPONSIVE_STATUS: DESKTOP_EXCELENTE_MOBILE_MEDIO

AUDIT_CORRECTIONS_FROM_FIRST_PASS:
  - Confirmed Producción and Personal are 100% FUNCTIONAL_PERSISTENT connected to Supabase Staging.
  - Clarified separation between deployed SHA 30dfba7 vs feature branches (feature/extractos SHA 53b2d8d and feature/escandallos SHA 2b3ac583).
  - Documented exact behavior of Compras UI vs legacy comprasWS.

FINAL_CONSOLIDATION_DECISION: USE_EXISTING_HUB_AS_CANONICAL_BASE
```

Final decision:
USE_EXISTING_HUB_AS_CANONICAL_BASE
