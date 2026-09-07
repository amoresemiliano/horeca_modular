# 02 - Evaluación Técnico-Funcional de Alternativas de Arquitectura (Fase 2B)

## 1. Marco y Alcance de Evaluación

En cumplimiento con la directiva de la Fase 2B, este estudio examina y compara cuatro topologías de arquitectura para dar soporte a los flujos del **Hub Económico** de **Taquería El Criollo**. La evaluación evita asumir capacidades como habilitadas de forma implícita y distingue estrictamente entre:
* **Capacidad ofrecida por el proveedor:** Características inherentes al motor, servicio o nube.
* **Configuración actualmente verificada:** Estado técnico real y comprobado dentro del repositorio.
* **Trabajo necesario para habilitarla:** Esfuerzo de diseño de políticas, integración de autenticación, modelado relacional y aprovisionamiento.
* **Riesgo de mala configuración:** Factores que podrían derivar en pérdida de aislamiento o exposición innecesaria de datos civiles y mercantiles.
* **Coste o limitación del plan:** Condicionantes asociados a planes gratuitos, de nivel básico o costos escalables variables.

## 2. Alternativa A — SPA + Supabase (PostgreSQL Administrado)

### 2.1. Descripción Arquitectónica
Consiste en conectar la Single Page Application (SPA React/Vite) a un servicio de Backend as a Service (BaaS) administrado que encapsula una base de datos PostgreSQL estándar, capacidades nativas de Row Level Security (RLS), Supabase Storage para archivos pesados e instancias opcionales de funciones en el borde (*Edge Functions* en Deno/Node).

### 2.2. Distinción Estricta de Estado Técnico (Supabase)
* **PostgreSQL disponible:** El proveedor ofrece un motor PostgreSQL con capacidades transaccionales ACID y soporte relacional completo.
* **RLS disponible:** El proveedor permite establecer reglas de acceso por fila (`Row Level Security`) integradas al motor.
* **Políticas reales todavía no diseñadas:** No se han verificado políticas RLS configuradas para resguardar las 12 fuentes operativas ni las entidades propuestas para el ciclo de importación. Su diseño es trabajo pendiente por realizar.
* **Storage disponible:** El proveedor ofrece almacenamiento compatible con S3 para guardar reportes bancarios y operativos crudos.
* **Buckets y permisos todavía no configurados:** En el código verificado no existen buckets ni reglas de acceso al Storage configuradas ni integradas a la interfaz.
* **Backups dependientes del plan:** En planes gratuitos o de entrada, los backups automatizados y la recuperación point-in-time (PITR) pueden ser limitados u opcionales, debiéndose planificar exportaciones lógicas explícitas programadas.
* **Autenticación todavía no migrada:** La interfaz actual operada emplea Firebase Auth; por tanto, la activación nativa de RLS basada en usuario no es inmediata y exige la migración del login o la integración de adaptadores y tokens.
* **Posible dependencia de funciones/backend:** Operaciones pesadas, tales como la validación intensiva de miles de filas Excel o transacciones de conciliación de alta complejidad, pueden necesitar ser trasladadas a Edge Functions para preservar la memoria de la SPA.

### 2.3. Evaluación Objetiva
Es la opción que mayor cohesión ofrece entre integridad relacional e integración frontend. No obstante, no representa una solución inmediata sin trabajo adicional: para alcanzar un nivel de seguridad y rendimiento aceptable se deberá diseñar un modelo relacional estandarizado, redactar las políticas RLS y abordar con método el intercambio y verificación de identidad.

---

## 3. Alternativa B — SPA + API propia + PostgreSQL en VPS/PaaS

### 3.1. Descripción Arquitectónica
Arquitectura clásica de tres capas donde el frontend React/Vite se comunica mediante HTTPS con un servidor dedicado u ordenado como servicio (ej. API Node.js/Express o equivalente) ejecutándose en una plataforma de hosting o VPS (Render, Hetzner, Railway). Esta API centraliza la lógica comercial y las transacciones sobre un servidor PostgreSQL autogestionado, conectándose a repositorios externos de almacenamiento de archivos (S3 o Cloudflare R2).

### 3.2. Distinción Estricta de Estado Técnico
* **Capacidad ofrecida:** Flexibilidad absoluta en enrutamiento, validación transaccional y separación estricta entre el navegador y las claves o motor de base de datos.
* **Configuración verificada:** Inexistente en la actualidad dentro del repositorio `el-criollo-ecosistema/` (ausencia de directivas o carpetas con servicios Express/Node backend de producción).
* **Trabajo necesario:** Elevado. Exige construir la capa completa de enrutamiento web, controladores HTTP, middleware de validación, ORM/query builder, y adaptadores de conexión remotos hacia el servidor de Storage externo y a la base de datos PostgreSQL.
* **Riesgo de mala configuración:** El mantenimiento recae íntegramente sobre los desarrolladores del sistema (actualizaciones de seguridad, parches del sistema operativo de VPS o Node, gestión manual de logs y control de puertos de red).
* **Coste o limitación del plan:** Supone costes iniciales recurrentes por la contratación de instancias computacionales activas para la API y la base de datos PostgreSQL independiente.

---

## 4. Alternativa C — SPA + API propia + MySQL en Bluehost

### 4.1. Descripción Arquitectónica
Aprovechamiento de la infraestructura y cuenta de hosting compartido preexistente en Bluehost. El frontend React/Vite invoca scripts del lado de servidor (en PHP o Node compatible con cPanel) los cuales persisten datos en el motor MySQL provisto por el panel de hosting, archivando los reportes Excel o CSV entrantes dentro del sistema de ficheros del propio servidor en el árbol de directorios locales.

### 4.2. Distinción Estricta de Estado Técnico
* **Capacidad ofrecida:** Conexión con MySQL clásico con tablas relacionales básicas (InnoDB) dentro del entorno de hosting convencional ya adquirido por Vegen Digital SL.
* **Configuración verificada:** El proyecto actualmente no contiene servicios API o PHP adaptados para la ingesta de los ficheros masivos o las estructuras relacionales de Extractos y TPV.
* **Trabajo necesario:** Construcción programática de endpoints, validaciones de seguridad manual en código web para sustituir la ausencia de RLS del motor relacional, y rutinas personalizadas para manipulación del sistema de ficheros en el entorno cPanel.
* **Riesgo de mala configuración:** Riesgo apreciable derivado del almacenamiento de informes bancarios en un sistema de archivos en entorno compartido (cPanel). Asimismo, las limitaciones estándar del entorno compartido respecto a límites de memoria y tiempos de ejecución de scripts (`max_execution_time`, `memory_limit`) pueden provocar bloqueos intermitentes al cargar o previsualizar grandes reportes que aglutinen miles de filas transaccionales.
* **Coste o limitación del plan:** Coste adicional inicial nulo, pero restringido severamente por políticas de recursos de procesamiento en servidores compartidos.

---

## 5. Alternativa D — Firebase Híbrido (NoSQL + SQL o Adaptadores Auxiliares)

### 5.1. Descripción Arquitectónica
Continuación del uso actual de Firebase Auth para sesiones e incorporación de la base de datos no relacional **Firestore (NoSQL)** para el almacenamiento operacional primario del sistema y **Firebase Storage** para el guardado de archivos transaccionales, recurriendo eventualmente a una base SQL secundaria o a procesos en la nube complementarios para realizar conciliaciones y agregaciones analíticas complejas.

### 5.2. Distinción Estricta de Estado Técnico
* **Capacidad ofrecida:** Sincronización ágil en tiempo real para clientes móviles o web simples, provisto por Google Cloud sin administración directa del servidor físico.
* **Configuración verificada:** Firebase Auth está actualmente habilitado e integrado a la interfaz cliente; Firestore y Storage se encuentran vacíos de esquemas y sin invocaciones desde los módulos de Extractos actuales en `src/`.
* **Trabajo necesario:** Diseñar colecciones y reglas documentales en Firestore. De requerirse cruces analíticos 1:N o N:M para liquidaciones de delivery contra extractos de banco, se hace imprescindible construir mecanismos adicionales que extraigan los documentos NoSQL, calculen las relaciones en memoria o las sincronicen de manera programática hacia un motor SQL independiente.
* **Riesgo de mala configuración:** El modelo NoSQL documental carece por naturaleza de restricciones referenciales ACID nativas (claves foráneas e inyecciones de dependencias formales en el servidor de base de datos). Sincronizar un motor documental y un motor relacional externo para salvaguardar la contabilidad multiplica los puntos de fallo transaccional.
* **Coste o limitación del plan:** Los planes de Firebase (por ejemplo, el Plan Spark gratuito inicial o Blaze facturado según consumo) cobran por lectura, escritura y eliminación de cada documento individual. Los flujos HORECA intensivos que consultan periódicamente listados o reportes masivos para conciliar pueden ocasionar incrementos variables significativos en los costes de suscripción.
