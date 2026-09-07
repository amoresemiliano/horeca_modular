# 06 - Gestión de Identidad, Autenticación y Autorización (Fase 2B)

## 1. Estado Verificable de la Identidad en el Repositorio

A diferencia de evaluaciones dogmáticas o excluyentes, el presente diagnóstico **no declara que el uso en cliente de Firebase Auth imposibilite desde el punto de vista técnico la aplicación de políticas de Seguridad a Nivel de Fila (Row Level Security - RLS) en el motor de PostgreSQL alojado por Supabase**, puesto que el protocolo RLS en PostgreSQL admite de forma nativa la interpretación de tokens JWT emitidos por proveedores externos cuando el cliente relacional o las políticas se configuran ad-hoc.

Sin embargo, tras la inspección del estado arquitectónico actual, se documentan con rigurosidad los siguientes **hechos verificados**:
1. **Firebase Auth se encuentra formalmente inicializado** y es utilizado por `src/App.jsx` para resolver si el operador actual posee una sesión de sistema activa para el acceso a la plataforma.
2. **Supabase dispone en `src/lib/supabase.js` de una instancia de cliente HTTP REST inicializada en crudo con la clave pública del proyecto y el token de acceso del rol anónimo (`anon_key`)**.
3. **No se ha verificado en el código del repositorio la existencia de adaptadores de integración de identidad**, intercambio de tokens (Token Exchange), o inyecciones de cabeceras de autorización que trasladen el identificador del usuario de Firebase o su JWT hacia las peticiones salientes dirigidas a Supabase.
4. **Las políticas RLS reales o existentes en las tablas transaccionales de la base de datos no han podido ser verificadas en esta fase estática**; no existe constancia codificada en el repositorio del diseño o alcance de tales políticas en la infraestructura administrada de Supabase.
5. **Es imperativo prohibir la apertura del acceso financiero al rol anónimo:** En salvaguarda del Secreto Mercantil y del Reglamento General de Protección de Datos (RGPD), queda terminantemente vetado en toda fase posterior configurar políticas que otorguen al rol público anónimo (`anon`) permisos de lectura o escritura libre sobre las tablas vinculadas a extractos, facturaciones o liquidaciones.

---

## 2. Estudio Comparativo de Estrategias de Identidad para la Transición

Con el propósito de proveer una hoja de ruta transicionable para la primera vertical del MVP y garantizar el resguardo a nivel RLS y API, se han comparado tres estrategias de arquitectura de autenticación.

```mermaid
flowchart TD
    subgraph ESTRATEGIA_B [Estrategia B: Convivencia Temporal (Recomendada para MVP)]
        F_AUTH[Firebase Auth en Cliente] -->|Token / Sesión Activa| ADAPTER[Adaptador Transitorio / JWT Mapped]
        ADAPTER -->|Cabecera de Seguridad| SUPA_DB[(Supabase PostgreSQL / RLS Activo)]
    end
```

### 2.1. Estrategia A — Migración Inmediata y Definitiva a Supabase Auth
Reemplazo acelerado en todo el código base de la dependencia `firebase/auth` por `@supabase/supabase-js` para gestión de sesiones desde el inicio de la Fase 2, sustituyendo las llamadas en `Login.jsx`, `App.jsx` y `MainLayout.jsx`.
* **Impacto en usuarios actuales:** Medio-Alto. Obliga a regenerar o reinstanciar las credenciales y registros de inicio de sesión del personal gerencial o de sala habilitado en el ERP.
* **Riesgo de cierre de sesión:** Elevado. Al activarse el nuevo código, cualquier operador conectado bajo las cookies o localStorage con token de Firebase perdería el acceso, experimentando un cierre violento de su sesión de trabajo en el TPV/ERP activo.
* **Módulos afectados:** En el orden local afectaría al módulo raíz (`App.jsx`, `Login.jsx`), a la barra superior (`MainLayout.jsx`) y potencialmente al enrutado del portal ERP.
* **Complejidad:** Media. Si bien el código y lógica de autenticación en Supabase Auth y Firebase Auth mantienen interfaces con paradigmas afines (correo/contraseña o estado asíncrono observables), exige modificar el núcleo operado de la aplicación existente antes de acometer la construcción funcional del Hub Económico.
* **Seguridad:** Óptima una vez finalizada, dado que el cliente REST acopla por defecto los tokens y activa las políticas RLS directas del proveedor de base de datos sin fricciones técnicas o intermediarios.
* **Tiempo:** Estimado en un ciclo suplementario adicional para desarrollo y estabilización exhaustiva del sistema de Login antes de reincorporar los parsers financieros.
* **Rollback (Reversión):** Dificultoso y propenso a desincronizar cuentas entre proveedores si coexisten credenciales dispares creadas con posterioridad al paso a producción de la alternativa sustitutiva.

### 2.2. Estrategia B — Convivencia Temporal mediante Adaptador y Migración Gradual
Conservar transitoriamente la inicialización y el login activo a cargo del cliente actual de Firebase Auth, pero instrumentando una capa intermedio-adaptativa en el cliente o motor web (por ejemplo mediante token exchange, inyección de custom headers transaccionales verificados o sincronización programada de identidad en Supabase). La migración definitiva del sistema de login y usuarios de los restaurantes se programa como un hito escindido a futuro posterior a la consolidación del motor contable.
* **Impacto en usuarios actuales:** Nulo de forma inmediata. El operador continúa introduciendo sus mismas credenciales de Firebase como hasta la fecha sin apercibirse en la interfaz de cambios internos o migraciones.
* **Riesgo de cierre de sesión:** Nulo. La sesión de trabajo activa en el ERP se respeta inalterada sin ocasionar caducidad imprevista sobre el servicio en sala.
* **Módulos afectados:** Limitado estrictamente al módulo de nueva construcción de Extractos y al servicio que inicialice las transacciones del cliente de base de datos (`src/lib/supabase.js`), salvaguardando intactos los componentes visuales de Login y Envoltura general del sistema.
* **Complejidad:** Media-Alta durante el tramo transitorio. Exige estudiar y documentar la validación y firma coherente o el canje en la configuración de la base de datos para interpretar con garantías de seguridad la sesión proveniente del ecosistema ajeno.
* **Seguridad:** Satisfactoria si la validación adaptativa o firma se instrumenta correctamente con un RLS no expuesto al público en la base de datos, manteniéndose aisladas las tablas relacionales operativas.
* **Tiempo:** Acotado. Permite destinar el 100% de la energía de desarrollo directa al ensamblaje del ciclo de ingesta previsualizable sin bloqueos de refactorización visual global previa.
* **Rollback (Reversión):** Excelente y limpia. Al no alterar la columna vertebral del sistema preexistente ni invalidar los sistemas autenticados en sala, cualquier anomalía se mitiga inhabilitando o desconectando el módulo importatorio emergente sin perjudicar al resto del ecosistema activo del restaurante.

### 2.3. Estrategia C — Mantener Firebase Auth + API/Backend Intermedio
Eludir la comunicación REST directa desde el navegador en cliente del sistema hacia Supabase. En su defecto, se interpone un servidor dedicado o colección de funciones de backend protegidas (por ejemplo, una API externa en Node/Vercel o Edge Functions en Deno/Supabase) con la misión de interceptar el JWT nativo de Firebase del usuario HORECA, contrastar criptográficamente su veracidad y vigencia con las llaves de Google e interactuar a continuación de forma directa desde el servidor hacia PostgreSQL haciendo uso del rol administrativo privado o del motor relacional con rol transaccional acotado.
* **Impacto en usuarios actuales:** Nulo. Interacción 100% transparente para los operadores habilitados en el restaurante.
* **Riesgo de cierre de sesión:** Nulo.
* **Módulos afectados:** Exento de impactos colaterales sobre el código cliente genérico del ERP, recluyéndose en las llamadas REST del nuevo módulo al backend propuesto.
* **Complejidad:** Muy Alta en la infraestructura general. Introduce de lleno la exigencia arquitectónica de programar, sostener y financiar una pasarela o capa de enrutamiento y procesamiento dedicada intermedia para salvaguardar y verificar manualmente la autorización de acceso en el plano de red, trasladando al servidor del programador la tarea que de otra forma realiza el motor de base de datos de manera transaccional y optimizada por hardware (RLS).
* **Seguridad:** Muy elevada si el servidor se codifica y protege sin vulnerabilidades de inyección en las comprobaciones, aunque depende de mantener credenciales de servicio secretas indisponibles ante accesos indebidos a nivel del servidor intermediario.
* **Tiempo:** Considerablemente extenso debido a la necesidad de construir a mano los endpoints y capas de serialización/deserialización para cada llamada transaccional de las siete entidades mínimas de la primera vertical.
* **Rollback:** Directo sobre la capa API intermedia impunemente ante el frontend.

---

## 3. Matriz Comparativa Rápida para Identidad

| Criterio | Estrategia A <br> *(Migración Inmediata a Supabase)* | Estrategia B <br> *(Convivencia Temporal por Adaptador)* | Estrategia C <br> *(Firebase + API/Backend Intermedio)* |
|---|:---:|:---:|:---:|
| **Impacto Operativo Sala/ERP** | Alto | **Nulo** | **Nulo** |
| **Riesgo de Corte de Sesión** | Elevado | **Nulo** | **Nulo** |
| **Complejidad de Integración** | Media (En UI) | **Media (En Adaptador)** | Muy Alta (En Servidor) |
| **Velocidad de Despliegue MVP** | Lenta (Por refactor de Login) | **Alta (Enfoque directo al Hub)**| Muy Lenta (Por boilerplate API) |
| **Aseguramiento RLS / DB** | Óptimo y Nativo | **Apto con Adaptador / Reglas**| Dependiente del Código del Backend|
| **Capacidad de Rollback** | Compleja | **Excelente** | Excelente |

---

## 4. Estrategia Oficial Recomendada para el MVP (Sin Alterar el Login Existente)

De conformidad con el imperativo metodológico de la **Regla de Oro** (mantener indisputado e intacto el servicio HORECA operado) y para viabilizar el desarrollo acelerado y blindado del módulo en la primera vertical sin bloqueos directivos en cadena:

1. **Se selecciona y recomienda formalmente la ESTRATEGIA B (Convivencia Temporal mediante Adaptador y Migración Gradual)** como el mecanismo operativo de identidad transitorio aplicable al inicio de la **Fase 2 productiva**.
2. **Conservación del Login Existente:** Durante el despliegue del MVP y validación del laboratorio de previsualización en producción, **no se alterarán las pantallas ni flujos preexistentes de autenticación en `Login.jsx` y `App.jsx`**, evitándose cierres forzosos de sesión, desconexiones masivas o rotaciones intempestivas de credenciales al personal activo del restaurante.
3. **Mantenimiento del Aislamiento Financiero:** Para conciliar esta convivencia temporal sin contravenir el veto expreso de seguridad (la proscripción categórica de abrir las tablas contables relacionales al rol público y anónimo del cliente Supabase), en el diseño del adaptador para la Fase 2 se verificará que toda petición de importación o consulta contable vaya refrendada transitoriamente por un token o pasarela segura y autenticada (incluso utilizando una función Cloud en el borde para verificar la sesión de Firebase en el instante crítico de volcar lotes al motor relacional si se advierten impedimentos al mapear el token de sesión en las tablas de PostgreSQL).
4. **Hoja de Ruta Posteriores al MVP:** Una vez probadas satisfactoriamente las mecánicas financieras en producción con la primera vertical, la dirección ordenará un plan quirúrgico secundario específico de refactorización de sesiones que aborde de manera monográfica la transicion final desde la librería de autenticación cliente actual hacia la solución de identidad relacional centralizada.
