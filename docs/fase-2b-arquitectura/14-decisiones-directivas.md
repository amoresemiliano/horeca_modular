# 14 - Delimitación y Registro de Decisiones Directivas para la Primera Vertical (Fase 2B)

## 1. Naturaleza del Filtro y Criterio Directivo de Bloqueo

Para prevenir la parálisis metodológica, la dispersión de esfuerzos de desarrollo o demoras lesivas sobre los calendarios operativos para dar paso a la implementación en firme del **Hub Económico** y al reemplazo de su prototipo anterior de extractos, el presente instrumento directivo instaura un corte vinculante entre aquellas decisiones cuya resolución es requisito indispensable para validar y desplegar la primera vertical de ingesta y previsualización, frente al inventario de iniciativas y ampliaciones que deben quedar expresamente liberadas de interferir con este ciclo programado inicial.

---

## 2. Decisiones Bloqueantes de la Primera Vertical Operativa

Queda estipulado que las únicas siete (7) decisiones de arquitectura que revisten un carácter formal e indiscutible de **CONDICIÓN BLOQUEANTE Y EXCLUSIVA PARA EL DESPLIEGUE Y VALIDACIÓN DE LA PRIMERA VERTICAL EN STAGING/PRODUCCIÓN** son las que a continuación se detallan de forma cerrada y taxativa:

1. **Ratificación y Adopción de la Arquitectura Preseleccionada (SPA React/Vite + Supabase/PostgreSQL):**
   Validar formalmente el encargo de centrar los desarrollos transaccionales del motor de base de datos relacional y transaccional sobre PostgreSQL (Supabase), descartando en el acto para la ingesta en bruto alternativas no relacionales deficientes (NoSQL / Firebase) o entornos compartidos con riesgos para el archivo (Bluehost).
2. **Aprobación de la Estrategia de Autenticación y Compatibilidad para Staging y MVP (Estrategia B):**
   Ratificar en el plan directivo la adopción temporal del mecanismo adaptativo de convivencia (iniciando sesión inalteradamente mediante el actual Firebase Auth del TPV y trasladando su legitimidad por token de sesión, cabeceras personalizadas seguras o intermediarios en nube a las consultas dirigidas al motor PostgreSQL sin abrir la base al rol público y anónimo y evitando desconectadas o cierres intemperivos de sesión al personal en sala).
3. **Instauración Obligatorio e Inalterable del Storage Privado para Archivos Originales:**
   Exigencia indeclinable directiva que obliga a instanciar y verificar que cada cubo de almacenamiento (Storage en nube) es 100% privado, con rutas organizacionales estructuradas sanitizadas por el backend y prohibición de accesos públicos abiertos desde el navegador ajeno por Internet.
4. **Delimitación de la Ubicación del Procesamiento Definitivo (Estrategia Híbrida de Ingesta):**
   Aprobación expresa de la distribución de carga y seguridad por la cual las comprobaciones de peso, extensión o interfaz se ejecultan libremente en la SPA del cliente web local, mientras el desmontaje, cálculo oficial criptográfico inalterado en SHA-256, parseo intensivo y normalizaciones se confían transaccionando de forma blindada y central a servicios backend o funciones en el borde protegidas.
5. **Directivas y Gestión sobre la Dependencia de Excel (SheetJS / `xlsx 0.18.5`):**
   Aprobación formal condicionada bajo el dictamen `APROBAR_PARA_PROTOTIPO_CON_RESTRICCIONES`, mandatando que su integración sobre el portal de empresa o módulo transaccional ha de efectuarse de forma rigurosa y encapsulada por completo tras una interfaz en la frontera aislada desacoplada del framework (`src/domain/import-engine/`), programando obligatoriamente su invocación por carga diferida asíncrona (*Lazy-Loading*) si opera en exploradores locales, o en exclusivo tras el backend.
6. **Configuración y Aislamiento del Entorno de Staging y Preproducción (Fase 2C):**
   Autorización directiva para constituir un proyecto o base transaccional temporal independiente de pruebas en nube donde ejecutar la futura **Fase 2C** sin alterar ni arriesgar el funcionamiento operativo de los TPV HORECA operados actualmente en producción inalterable ni exponer datos de comedor HORECA reales incomprensibles al ensayo.
7. **Adopción de la Política Mínima de Backups y Reversiones No Lesivas:**
   Exigencia directiva e indispensable de programar, validar y ratificase una rutina consolidada complementada por exportación relacional (`pg_dump` programado encriptado en el exterior independiente) y habilitación de reversiones lógicas no destructivas antes o durante la liberación productiva de los flujos de conciliación HORECA al operador en sala del restaurante o a las pantallas del ERP de Taquería El Criollo / Vegen Digital SL.

---

## 3. Decisiones No Bloqueantes (Iniciativas Diferidas)

Por contraste indisputable con la sección precedente, se declara explícitamente y con fuerza directiva vinculante que la tramitación, definición técnico-legal, o en su caso postergación provisoria de las siguientes siete (7) temáticas e iniciativas **NO CONSTITUYEN BLOQUEO ALGUNO PARA EL INICIO NI PARA LA IMPLEMENTACIÓN DE LA PRIMERA VERTICAL OPERATIVA**, ordenando el cese de dilaciones en su invocación prematura:

1. **Desarrollo o Integración con la API en Tiempo Real de Last.app:**
   Su estudio o posible adopción se reserva a etapas posteriores o complementarias, subsistiendo íntegramente de modo soberano como canal y fuente primaria oficial de ingesta transaccional operativa para la Fase 2 el reporte tabular exportado por el restaurante: **`tabs-report` (en todas sus iteraciones de libros XLSX confirmadas en el Addendum)**.
2. **Arquitectura Multi-Tenant Comercial y de Onboarding SaaS:**
   Las pantallas, sistemas de alta inter-empresa y cobro por suscripciones de software a externos no frenan este desarrollo para laTaquería; bastando de forma suficiente y sobrada con el campo estipulado en la base temporal fijado en su valor único y constante para Vegen Digital SL (`organization_id`).
3. **Módulos o Motores Asistidos por Inteligencia Artificial (IA) o Machine Learning:**
   Las inferencias algorítmicas experimentales para predicción gastronómica o deducciones automáticas por redes neuronales o modelos estadísticos complejos no alteran, retrasan ni forman parte en absoluto del despliegue nuclear programado para el ciclo de importación verificable por código.
4. **Algoritmos Inteligentes o Flujos de Conciliación Avanzada y Cruzada N:M en Caliente:**
   Las mecánicas avanzadas y cruces contables en masa para relacionar liquidaciones en el delivery con las transferencias de las entidades bancarias o cajas en sala se construirán y encajarán de manera separada en iteraciones analíticas correlativas y subsiguientes del Hub Económico, tras certificar sin contratiempos o caídas visuales con la primera vertical la recepción, visualización paginada y carga confirmada de los datos en bruto y la normalización intermedia temporal en tablas del servidor relacional.
5. **Taxonomía, Árbol y Clasificación Contable y Gastronómica Definitiva del Ecosistema:**
   La tipificación pormenorizada de las cuentas de gasto HORECA (por ejemplo separar insumos en específicos como hortalizas vs cárnicos en escandallo en un plan de empresa estricto) no obstaculiza el avance técnico del sistema, pudiendo agregarse de modo progresivo sobre las tablas intermedias de tránsito y dominios posteriores creados al efecto.
6. **Automatizaciones y Conexiones Bancarias Directas en Caliente (Open Banking / PSD2):**
   La conexión automatizada con servidores o agregadores bancarios en tiempo real se reserva como un hito adicional o fase optativa del negocio en meses venideros; operando incesantemente la primera vertical sujeta con fiabilidad intachable a la ingesta documental e manual regular previsualizable transicionando desde archivos bancarios exportados en CSV/XLS de BBVA y Sabadell.
7. **Integración Contable Oficial en Libros Mayores e Impuestos Externos (VeriFactu / Contadores):**
   La adaptación y encarecimiento procedimental aplicados para enlazar al instante con programas contables o sistemas hacendisticos como VeriFactu (evaluados por separado en las decisiones D-11 a D-19 del proyecto) corren por canales paralelos y de cumplimiento normativo contable especializado que **en ningún aspecto interfieren, detienen ni aplazan el inicio inmediato del diseño técnico ni el desarrollo previsualizable del laboratorio o ingesta del módulo interno de Extractos** en los servidores de la empresa.
