# 06 - Deuda Técnica y Antipatrones de Diseño

## 1. Introducción y Clasificación del Deferir Técnico

El diagnóstico integral de la plataforma de Taquería El Criollo y sus subsistemas vinculados expone un volumen significativo de deuda técnica acumulada por la evolución rápida del código entre iteraciones experimentales y sistemas en producción. El presente documento estructura estos antipatrones y carencias de ingeniería en categorías críticas con sus referencias exactas en el código fuente.

---

## 2. Inventario de Deuda Técnica por Dimensión

### 2.1. Deuda Arquitectónica y de Persistencia
* **Dependencia Crítica del `localStorage` (HECHO VERIFICADO):**
  * En el módulo central de operaciones logísticas (`el_criollo_modular/src/modules/inventario/store/store.jsx:L80-L107`), los 6 reductores de datos (movimientos, usuarios, productos, formatos, presentaciones, almacenes) dependen al 100% de un almacenamiento en el `window.localStorage` del dispositivo local:
    ```javascript
    const [movimientos, setMovimientos] = usePersistedState('criollo_movimientos', INITIAL_MOVIMIENTOS);
    const [productos, setProductos] = usePersistedState('criollo_productos', INITIAL_PRODUCTOS);
    ```
  * **Antipatrón (Isla de Datos):** Esta implementación convierte el terminal del usuario en una "isla de datos no sincronizable". Si el jefe de almacén añade un producto en una tablet, el responsable de compras frente a su portátil del despacho verá un catálogo completamente divergente y ausente de esos cambios.
* **Fragmentación de Fuentes de Verdad (HECHO VERIFICADO):**
  * Coexisten cuatro repositorios de almacenamiento activos de manera paralela sin sincronizar:
    1. Base de datos MySQL `athcomar_comprasWS` para órdenes (BlueHost).
    2. Base de datos MySQL `athcomar_inventario` en legado PHP.
    3. Base de datos MySQL `athcomar_vegen_Last_API` en Node.js (cargas TPV).
    4. Base de datos PostgreSQL en Supabase para `extractos` y `horarios`.
  * Ninguno de estos motores comparte claves externas comunes ni procedimientos de replicación coordinados.

### 2.2. Deuda de Seguridad y Gestión de Errores
* **Manejo de Fallos "Silencioso" / Swallow Errors (HECHO VERIFICADO):**
  * En diversas rutinas críticas del módulo bancario (`ExtractosApp.jsx:L70, L99, L111`), los errores de transacción remota se capturan mediante bloques vacíos indebidos:
    ```javascript
    } catch (_) { /* offline */ }
    ```
  * **Antipatrón:** Omitir el registro y tratamiento explícito del error o su reporte en una interfaz observable impide que un usuario descubra que una escritura remota ha abortado por fallo de red, asumiendo erróneamente que la contabilidad del restaurante ha quedado respaldada en Supabase cuando solo quedó precariamente registrada en el caché temporal local.

### 2.3. Deuda de Calidad de Software y Cobertura de Pruebas (Testing)
* **Ausencia Absoluta de Pruebas Automatizadas (HECHO VERIFICADO):**
  * En `el_criollo_modular/package.json:L1-L37` y en las carpetas de los subsistemas `EC_pedidos`, `EC_inventario` y `last_API`, no consta configurada ninguna librería de pruebas unitarias ni de integración (ausencia completa de `jest`, `vitest`, `playwright`, `@testing-library/react`).
  * No se ha identificado ni un solo archivo con terminación `.test.js`, `.spec.jsx` o similar dentro del directorio de trabajo del ecosistema autorizado.
  * **Riesgo:** El refactorizado arquitectónico requerido para implementar el esquema SaaS Multi-Tenant no cuenta con un arnés de pruebas automatizadas que garantice la detección oportuna de regresiones o fallos contables silenciosos al alterar los componentes.

### 2.4. Deuda de Duplicación y Acoplamiento Curado (Coupling)
* **Duplicación de Entidades Contradictorias (HECHO VERIFICADO):**
  * La entidad de usuarios de negocio figura modelada y repetida hasta cinco veces con esquemas irreconciliables:
    1. En `athcomar_inventario_el_criollo.sql:L215`: Usuarios de almacén en tabla MySQL con campos y roles en bruto.
    2. En `pedidos/backend/database.sql:L9`: Tabla independiente `users` para autenticar pedidos en MySQL.
    3. En `last_API` MySQL: Tabla `users` indexada mediante cadenas de texto con UIDs cifrados de Firebase.
    4. En `el_criollo_modular` (Supabase): Tabla dedicada `empleados` desprovista de credencial para el control horario (`HorariosApp.jsx`).
    5. En `el_criollo_modular` (Inventario): Colección de usuarios falsa inicializada en `store.jsx` para el mock local en navegador.

---

## 3. Síntesis y Matriz de Mitigación Recomendada

| Categoría de Deuda Técnica | Componente Afectado | Riesgo Operativo | Esfuerzo de Remediación (1-5) | Recomendación Prioritaria Vegen Digital |
| :--- | :--- | :--- | :--- | :--- |
| **LocalStorage como BD de Almacén** | Módulo `Inventario` | **Extremo:** Incompatibilidad multiusuario y pérdida de datos al limpiar historial. | 4 (Alto) | Refactorizar los hooks de `store.jsx` para despachar llamadas al API de Supabase análogo a `ExtractosApp.jsx`. |
| **Swallow Errors en Bloques Catch** | `ExtractosApp.jsx`, etc. | **Alto:** Falsa percepción de seguridad ante fallos de sincronización con Supabase. | 2 (Bajo) | Integrar un manejador de estado (ej. toast de alertas en pantalla) que evidencie el rechazo del servidor u operación offline temporal. |
| **Cobertura Nula de Pruebas Automatizadas** | Todo el Ecosistema | **Crítico para SaaS:** Prohibido comercializar si una modificación de interfaz altera una cuenta o saldo sin detección inmediata. | 5 (Muy Alto) | Incorporar `Vitest` como motor ligero adjunto a Vite 6 y desplegar tests unitarios sobre las rutinas del motor bancario y deduplicador. |
| **Quintüple Redundancia en Usuarios** | BDs Legacy + Supabase + Firebase | **Medio-Alto:** Imposibilidad de revocar privilegios y accesos en cascada si un empleado causa baja en la empresa. | 5 (Muy Alto) | Centralizar el servicio de autenticación corporativo en Firebase Auth / Supabase y eliminar tablas huérfanas o heredadas en MySQL. |
