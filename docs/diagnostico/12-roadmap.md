# 12 - Hoja de Ruta de Implementación Progresiva (Roadmap)

## 1. Filosofía de Planificación y Criterio Temporal

En observancia de los mandatos protocolares del **Control de Calidad (Fase 0.5)**, el presente cronograma rechaza la estipulacioón de semanas, sprints inventados, duraciones estimadas a ciegas, capacidades de equipo sin medir o fechas fijas de finalización.
Toda la planificación transaccional y de reingeniería se articula en torno a **criterios de salida objetivamente comprobables, dependencias técnicas entre módulos y puertas de aceptación verificadas**.

> **NORMATIVA DE MARCADORES EN ESTE DOCUMENTO:**
> * **Ninguna tarea futura o de implementación posterior figura ni se declara como completada.**
> * Se emplea inexorablemente la sintaxis `[ ]` para referirse a todas las tareas técnicas y de ingeniería planificadas para las siguientes fases del proyecto.
> * Se inyecta la etiqueta `PENDIENTE DE DECISIÓN` en todas las actividades que exijan deliberación previa y resolución humana, contable o legal antes de proceder a su codificación.

---

## 2. Planificación Escalonada por Fases Operativas

### Fase 0.5 — Validación de Seguridad y Arquitectura
* **Objetivo Prioritorio:** Contener riesgos de seguridad en repositorios heredados, clarificar fronteras de datos e institucionalizar los controles de calidad documentales y técnicos antes de tocar el código web en activo.
* **Alcance:** Inventario pacífico de credenciales expuestas en Git, revisión no destructiva en servidor e incorporación de la matriz de evidencia del diagnóstico documental.
* **Exclusiones:** Queda excluida toda reescritura masiva de historial Git o modificación en caliente de las bases de datos en producción sin previa rotación probada.
* **Dependencias:** Culminación exitosa de la lectura estática de repositorios (Fase 0).
* **Entregables:** Paquete de 15 informes de diagnóstico técnico saneados, matriz de confianza y plan documental de mitigación de seguridad (Documentos `00` a `14` y `manifest.json`).
* **Riesgos (`RIESGO DE SEGURIDAD`):** Falta de vigencia o desajustes operacionales locales si las credenciales en bruto eran aprovechadas simultáneamente por terceros sin control.
* **Criterios de Aceptación:** Aprobación formal por parte del titular directivo del informe de control de calidad `14-control-calidad.md` y ratificación de la Regla de Oro de Continuidad Operacional en tienda.
* **Rollback:** Conservación intacta y reversible de las ramas y árboles de trabajo en Git en el estado verificado previas a la intervención.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Aprobación expresa sobre el protocolo temporal de rotación e inventario pacífico frente a la purga limpia en repositorios Git remoros.

---

### Fase 1 — Diseño Funcional y Técnico de Extractos
* **Objetivo Prioritorio:** Conceptualizar, documentar y fijar contractualmente el modelo relacional del módulo de conciliación bancaria para Taquería El Criollo.
* **Alcance:** Definición formal en DDL SQL (en seco) de la tabla contable y redacción algorítmica de los tres niveles del motor de deduplicación (Nivel A, Nivel B y Nivel C).
* **Exclusiones:** Prohíbase la implementación de restricciones de índice único universal que rechacen compras coincidentes en el mismo día por parecidos nominales sin evaluación humana.
* **Dependencias:** Superación formal del control de calidad en Fase 0.5.
* **Entregables:** Documento de Especificación Arquitectónica DDL para la ingesta bancaria y conjunto de esquemas para la normalización semántica de conceptos de pago en banco.
* **Riesgos (`RIESGO CONDICIONAL`):** Ocurrencia de falsos positivos en cocina si la lógica relacional no toma en consideración el saldo contable posterior decreciente y el orden correlativo original en el archivo.
* **Criterios de Aceptación:** Validación de que el esquema transaccional en borrador contempla satisfactoriamente las ocho casuísticas obligatorias relativas al manejo de caja contable (solapamientos, anulaciones, devoluciones y correcciones).
* **Rollback:** Desestimación del borrador DDL y retorno a la revisión documental sin afectación sobre código cliente ni base de datos en nube.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Consultar con asesores o contadores del negocio las implicaciones contables aplicables bajo el Plan General Contable HORECA en España.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 1.1:** Elaborar el borrador del esquema relacional DDL (tablas `importaciones_lotes`, `extractos_movimientos`, `cuentas_canales`) integrando los atributos obligados del Nivel B de deduplicación contable.
* [ ] **Tarea 1.2:** Redactar la especificación formal del analizador y diccionario de normalización de cadenas para procesar cabeceras en mayúscula/minúscula de entidades financieras.
* [ ] **Tarea 1.3 (`PENDIENTE DE DECISIÓN`):** Someter el diseño del modelo contable relacional a validación administrativa y aprobación por el equipo humano del cliente.

---

### Fase 2 — MVP de Importación y Clasificación de Extractos
* **Objetivo Prioritorio:** Dotar a la SPA maestra del restaurante titular (El Criollo) de una interfaz operativa funcional apta para parsear e importar extractos bancarios verdaderos en hoja de cálculo en el navegador web del administrador.
* **Alcance:** Integración en `ImportModal.jsx` de una librería lectora habilitada para ficheros binarios Microsoft Excel (`.xls` / `.xlsx`) junto al mantenimiento de la lectura CSV.
* **Exclusiones:** Quedan excluidos los desarrollos dirigidos a la compartimentación de datos o creación de cuentas corporativas para clientes ajenos (Multi-Tenant).
* **Dependencias:** Aprobación del diseño funcional relacional formulado durante la Fase 1.
* **Entregables:** Componente modular importador probado y operativo para parsear planillas bancarias del Banco Sabadell y BBVA en beneficio de la contabilidad titular del restaurante.
* **Riesgos (`REQUISITO TÉCNICO`):** Bloqueo en el cliente por alto consumo de memoria o bundle abultado si la librería binaria importada excede la capacidad del navegador.
* **Criterios de Aceptación:** Demostración empírica de que el importador procesa con éxito las cinco muestras reales preservadas en `input-samples/extractos/`, clasificando en sala y marcando de forma voluntaria para revisión al candidato ambiguo o solapado sin truncar registros legítimos idénticos.
* **Rollback:** Reversible reinstalando el estado previo del componente modular o inhabilitando el nuevo lector y conservando el parser CSV en `ImportModal.jsx`.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Homologar y aprobar qué librería libre o paquete comercial de JavaScript se autoriza importar al ecosistema para la decodificación en cliente del formato Excel BIFF8 / XML.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 2.1:** Incorporar de manera acotada una librería de parseo compatible con los libros en binario de Excel al componente importador web del cliente de React.
* [ ] **Tarea 2.2:** Programar los traductores gramaticales para reconocer unívocamente las cabeceras variables documentadas para el Banco Sabadell y cuentas BBVA.
* [ ] **Tarea 2.3:** Configurar y programar en el cliente el filtro que compare la firma global del archivo para alertar sobre reimportaciones exactas previas en Nivel A.

---

### Fase 3 — Migración Histórica y Análisis de Sala
* **Objetivo Prioritorio:** Trasladar con seguridad procesal y sin pérdidas contables los historiales monetarios acumulados en libros Excel consolidados hacia la tabla unificada elegida para posibilitar gráficas contables en la SPA.
* **Alcance:** Carga supervisada del archivo histórico `Planilla Movimientos - Consolidado.xlsx` y activación del panel de gráficas analíticas y saldos decrecientes en la SPA del establecimiento.
* **Exclusiones:** No autorizar mutaciones que sobreescriban ficheros originales de Excel ni alterar registros fiscales precedentes.
* **Dependencias:** Validación del MVP funcional para importación de extractos bancarios operada en Fase 2.
* **Entregables:** Base de datos con el historial conciliado cargado en limpio y módulo visual de análisis salarial y financiero en `ExtractosApp.jsx`.
* **Riesgos (`RIESGO CONDICIONAL`):** Descuadres monetarios si las pestañas o filas de la planilla consolidada albergaban correcciones bancarias retrasadas en fecha.
* **Criterios de Aceptación:** Conciliación contable donde el saldo bancario acumulado devuelto por la consulta en el sistema coincide al centavo con el balance del libro contable oficial del restaurante al cierre de cada mes exportado.
* **Rollback:** Vaciado transaccional selectivo por identificador de lote de la tabla en base de datos en nube en caso de anomalías y retorno al libro en hoja de Excel.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Validación jurídica, fiscal y laboral previa ante asesores externos antes de importar libros contables o bancarios que involucren pagos y transferencias a cuenta bancaria con datos personales de empleados (RGPD).

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 3.1 (`PENDIENTE DE DECISIÓN`):** Recabar dictamen de asesoría contable o legal antes de transcribir la información del fichero consolidado hacia repositorios de almacenamiento remotos.
* [ ] **Tarea 3.2:** Ejecutar la importación supervisada por lotes del libro histórico en la plataforma, verificando la inmutabilidad de origen (Nivel B).
* [ ] **Tarea 3.3:** Activar las tablas de consulta analítica y filtros en el panel de control bancario para presentar reportes del flujo de caja al gerente en sala.

---

### Fase 4 — Estabilización e Integración Progresiva de Pedidos
* **Objetivo Prioritorio:** Blindar la continuidad operativa del sistema de compras en sala al tiempo que se habilita un camino no destructivo hacia la unificación de la interfaz y persistencia corporaria.
* **Alcance:** Endurecimiento de la seguridad local del sistema en PHP (`EC_pedidos`), rotación de credenciales expuestas y construcción de un conector API web transitorio o módulo paralizado de paridad funcional en React 19.
* **Exclusiones:** Prohibido clausurar, retirar, borrar o desconectar el servidor actual en PHP/MySQL (Bluehost) durante el transcurso ordinario de esta fase transaccional.
* **Dependencias:** Conclusión exitosa y estabilización operativa demostrada en cocina de las labores previas.
* **Entregables:** Pasarela PHP asegurada localmente sin credenciales visibles al público y prototipo equivalente operativo con buscador ágil autoconectable integrado en React para pruebas paralelas en espejo.
* **Riesgos (`RIESGO CONDICIONAL` / `HECHO VERIFICADO`):** Caída del servicio de encargo de carnes e insumos si una modificación inoportuna en los scripts sobre cPanel/Bluehost rompe el flujo que redirige a `window.open('https://wa.me/...')`.
* **Criterios de Aceptación:** Paridad funcional confirmada: la nueva herramienta temporal transfiere en paralelo exactamenter el mismo listado con cantidades y la misma sintaxis formal a la pasarela de WhatsApp que la herramienta heredada habitual.
* **Rollback:** Mantenimiento activo y sin alterar del enlace original a la pasarela web en PHP para que el operario de almacén cambie de ventana en línea al instante ante el menor fallo técnico del módulo en la SPA.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Decidir en base al análisis directivo qué alternativa estratégica formal (Alternativa B: API segura en MySQL vs. Alternativa C: Migrar progresiva a Supabase/PostgreSQL) se aprueba para acoplar la lógica de este dominio en el mediano plazo.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 4.1:** Ejecutar pacíficamente el inventario local y rotación coordinada de contraseñas MySQL asociadas a `comprasWS` con re-inyección local por variables que no residan en Git.
* [ ] **Tarea 4.2 (`PENDIENTE DE DECISIÓN`):** Resolver formalmente si el backend de este módulo transitará hacia una base relacional cloud compartida o conservará el servidor de Bluehost como punto de apoyo con nuevo adaptador web.
* [ ] **Tarea 4.3:** Replicar con fidelidad milimétrica en el componente modular de la SPA en React la rutina del buscador veloz tipo Tom-Select y la cadena formal del despacho para el canal web en WhatsApp.
* [ ] **Tarea 4.4:** Coordinar una ventana paralela de testeo transaccional y en espejo con el jefe de compras y almacén del restaurante en sala, sin clausurar el servidor PHP.

---

### Fase 5 — Catálogo Maestro e Inventario en Línea
* **Objetivo Prioritorio:** Extirpar del ecosistema operativo el almacenamiento efímero local del navegador web (`localStorage`) en el almacén de existencias, acoplándolo a un catálogo maestro unificado e incompatible con la ruptura de stock y colisiones referenciales.
* **Alcance:** Creación del diccionario canónico compartible entre las listas de compras y existencias y migración del estado en `store.jsx` hacia tablas relacionales remotas provistas de claves foráneas entre entidades físicas de cocina.
* **Exclusiones:** Exclusión de cálculos estadísticos o analíticos basados en inteligencia artificial predecible hasta no garantizar que cada litro, caja, botella y gramo está correctamente contabilizado en tablas relacionales.
* **Dependencias:** Aprobación directiva sobre el motor de base de datos canónico y finalización de la integración progresiva pacífica con Pedidos (Fase 4).
* **Entregables:** Módulo de Inventario refactorizado comunicando con transacciones remotas verificables (sin rastro de `window.localStorage`) y manual diccionarial normativo de nombres y unidades en cocina.
* **Riesgos (`RIESGO DE SEGURIDAD` / `REQUISITO TÉCNICO`):** Pérdida masiva del catálogo del restaurante o falta de acceso en almacén si las políticas de autorización (RLS) impiden a los cocineros autenticados leer el catálogo general al conectarse desde terminales móviles heterogéneas.
* **Criterios de Aceptación:** Las consultas de entradas y salidas de almacén realizadas al unísono y en paralelo desde tres terminales diferentes del local muestran sincronía instantánea en la nube y resisten el borrado en bruto de la caché y cookies de los navegadores locales sin mutar el stock general.
* **Rollback:** Resguardo del hook original `usePersistedState` y volcado de las listas a ficheros temporales tipo JSON o CSV locales de respaldo por si el servidor remoto sufriere problemas de latencia o corte momentáneo de red externa en el restaurante.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Homologar y dictaminar directivamente bajo qué regla y guía idiomática institucional (singlares, plurales, castellano del PGC o notación técnica en inglés) se denominarán las tablas y columnas maestras del nuevo catálogo general en las bases relacionales elegidas.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 5.1 (`PENDIENTE DE DECISIÓN`):** Acordar formalmente la nomenclatura unificada de las entidades del catálogo de almacenes y definir los identificadores y claves foráneas en firme para productos, categorías y proveedores gastronómicos.
* [ ] **Tarea 5.2:** Reingenierizar los reducers del módulo `src/modules/inventario/store.jsx`, extirpando y cancelando definitivamente las lecturas y escrituras transaccionales sobre la memoria del navegador `window.localStorage`.
* [ ] **Tarea 5.3:** Diseñar e instrumentar las consultas autenticadas en el cliente web hacia el servicio relacional central para consultar, descargar e insertar altas y bajas físicas del inventario interconectadas al catálogo general de compras.
* [ ] **Tarea 5.4:** Instrumentar pruebas automatizadas (unitarias y de integración) para confirmar el cálculo exacto del stock contable tras transacciones concurrentes entre almacenes y cocina.

---

### Fase 6 — Ventas, Webhooks y TPV Last.app
* **Objetivo Prioritorio:** Asegurar y blindar perimetralmente las conexiones de red en el servidor analítico de cocina (puerto 3001) y encauzar transaccional las ventas en tiempo real hacia las vistas contables del establecimiento sin sobrecargas por descargas manuales de CSV.
* **Alcance:** Implementación del control criptográfico elegido sobre el endpoint `/webhook/lastapp` y posible transposición o acoplamiento del motor analítico de ventas del restaurante en la nube o servicio relacional integrado.
* **Exclusiones:** Prohibido asumir capacidades no documentadas en el manual del TPV del fabricante ni interferir indebidamente con el hardware oficial que opera el servicio de cobro físico al comensal en las mesas del restaurante en activo.
* **Dependencias:** Estabilidad comprobada del catálogo general de almacén en Fase 5.
* **Entregables:** Puerto receptor protegido por secreto o verificación y motor web analítico inyectando tickets directamente sobre el almacén histórico consultable por el módulo `VentasApp.jsx`.
* **Riesgos (`RIESGO DE SEGURIDAD`):** Rechazo incidental de notificaciones legítimas entrantes o pérdida temporal del enlace de actualización en tiempo real al monitor de sala de cocina y barra si la verificación criptográfica HMAC desaconsejadamente calculada bloquea al proveedor.
* **Criterios de Aceptación:** Toda petición externa simulada contra el puerto 3001 sin la firma, token o secreto acordado es repelida por el servidor con código HTTP 401 o 403 y se registra en el archivo auditado sin retransmitirse al canal abierto de Socket.IO, al tiempo que las comandas firmadas del TPV continúan reflejando en tiempo real y sin latencia añadida en las pantallas de sala.
* **Rollback:** Interrupción programada del validador criptográfico y conmutación transitoria transaccional hacia un esquema por allowlist de direcciones IP autorizadas o consulta de polling temporizado en el servidor si la pasarela experimentase caídas inusuales en sala.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Consultar formalmente la documentación técnica del proveedor externo de software `Last.app` para seleccionar sobre evidencia demostrable cuál de los ocho controles del menú de blindaje de webhooks (Firma oficial HMAC, secreto compartido en URL, tokens estáticos, API gateway o polling programado) se autoriza instrumentar al backend de cocina.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 6.1 (`PENDIENTE DE DECISIÓN`):** Auditar e interrogar la especificación técnica oficial del TPV comercial del restaurante para dictaminar el mecanismo canónico de blindaje y certificación del webhook receptor en `/webhook/lastapp`.
* [ ] **Tarea 6.2:** Codificar e implementar en `server.js:L324` o en la función receptora en nube elegida elmiddleware validador de origen y control criptográfico acordado.
* [ ] **Tarea 6.3:** Conectar el flujo analítico de recepción de tickets de venta con el catálogo unificado en el servidor relacional, suprimiendo la obligatoriedad administrativa de exportar e importar cotidianos ficheros manuales CSV en los módulos `VentasApp.jsx` y `KpisApp.jsx`.

---

### Fase 7 — Escandallos, Producción y KPIs Analíticos
* **Objetivo Prioritorio:** Transformar las maquetas visuales de inteligencia de negocio y cálculo gastronómico en herramientas funcionales operadas por la gerencia para supervisar en línea el margen bruto, mermas de almacén e ingeniería de menú por Matriz BCG.
* **Alcance:** Conexión de los módulos de la SPA (`Escandallos`, `KPIs` y `Predicción`) al maestro de precios transaccionales y despliegue opcional de cálculos analíticos sin servidor (Edge Functions o rutinas en backend web).
* **Exclusiones:** No activar sistemas algorítmicos automatizados de pedidos automáticos sin firma que envíen órdenes o comprometan dinero con terceros sin confirmación o supervisión humana obligada.
* **Dependencias:** Consolidación demostrada de flujos transaccionales de entradas (Fase 4 y 5) y salidas transaccionales contables de venta TPV (Fase 6).
* **Entregables:** Cuadernos y gráficas analíticas en tiempo real (Chart.js en SPA) ilustrando al detalle el coste por receta y rendimiento del menú (Estrellas, Burros, Enigmas y Perros).
* **Riesgos (`INFERENCIA`):** Latencias elevadas al renderizar consultas agregadas complejas en navegadores portátiles si el cálculo contable es derivado al cliente web en lugar de computarse agregadamente del lado de base del servidor.
* **Criterios de Aceptación:** Un incremento en el precio del litro de aceite, carne o insumo tramitado y guardado mediante el módulo de Compras repercute y actualiza sincrónicamente y con exactitud milimétrica el costo marginal por porción y la rentabilidad analítica visible en la pestaña de Recetas y en la Matriz BCG del panel directivo.
* **Rollback:** Conmutación inalterada hacia las consultas estáticas o descarga auxiliar y visualización de reportes manuales precacabados por lote transitorio, sin entorpecer ni bloquear la actividad transaccional general ni los desgloses en almacén.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Aprobar si las fórmulas y cálculos contables pesados asociados a las proyecciones estadísticas y Matriz BCG serán transpuestos a funciones sin servidor en la nube elegida o permanecerán siendo calculadas y suministradas transaccionalmente al vuelo desde las rutinas del servidor en el puerto 3001.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 7.1 (`PENDIENTE DE DECISIÓN`):** Dictaminar si el motor algorítmico y matemático analítico de menú radicará de forma transmutada en funciones nube, rutinas en base de datos o en el servicio de Node.js en activo.
* [ ] **Tarea 7.2:** Conectar la interfaz del módulo de `Escandallos` y Recetas gastronómicas a las tablas contables unificadas de compras e insumos del almacén.
* [ ] **Tarea 7.3:** Inyectar los cálculos estadísticos en tiempo real sobre las visualizaciones con Chart.js en `KpisApp.jsx`, sustituyendo de forma permanente y verificable los mocks estáticos heredados sin persistente transaccional.

---

### Fase 8 — Preparación Arquitectónica para Comercialización SaaS Multi-Tenant
* **Objetivo Prioritorio:** Habilitar el horizonte comercial directivo de la empresa transformando la plataforma probada titularmente de forma segura en un software HORECA multiempresa distribuible en régimen de suscripción a terceros restaurantes por España y el exterior.
* **Alcance:** Integración en las tablas y esquemas DDL relacionales del campo de aislamiento organizacional (`tenant_id`), activación y homologación estricta de políticas de seguridad por fila (RLS), creación del onboarding comercial y paneles de superadministración técnica global.
* **Exclusiones:** Prohíase en absoluto ejecutar ni poner en marcha esta etapa organizativa hasta no certificar el 100% de la estabilidad transaccional, seguridad inquebrantada e independencia contable de la operación titular en las salas del restaurante Taquería El Criollo.
* **Dependencias:** Superación total y estabilización fehaciente probada del ecosistema operativo de El Criollo sin fisuras a lo largo de las Fases 1 hasta 7 previas.
* **Entregables:** Base de datos multiempresa blindada mediante políticas RLS y arquitectura transaccional SaaS operativa con separación estricta y verificable de corporaciones independientes.
* **Riesgos (`RIESGO DE SEGURIDAD` / `POSIBLE IMPLICACIÓN LEGAL`):** Exposición de cuentas bancarias de terceros o colisiones de inventario comercial cruzadas entre restaurantes suscriptores ajenos por culpa de una política SQL mal formulada o el uso del cliente anónimo sin filtro relacional en el servidor.
* **Criterios de Aceptación:** Ejecución exitosa y auditable ante consultoría independiente en el arnés de test automatizados (Vitest/E2E) demostrando con exactitud cero falsos positivos transaccionales: un intento programático o simulado por parte de un usuario con token JWT autenticado del Tenant "B" por leer, escribir o alterar filas contables que tengan grabado en su columna de seguridad la marca organizacional o pertenencia del Tenant "A" debe ser repelido inquebrante y fulminante en la raíz por el motor relacional en el servidor remoto con un rechazo explicito de seguridad.
* **Rollback:** Clausura programática perentoria de las suscripciones corporatives para terceros, revocación transaccional del servicio en caliente y conmutación perimétrica instantánea de las bases para recuperar la exclusividad de funcionamiento como aplicación Single-Tenant orientada y cerrada al servicio en exclusiva del titular soberano local El Criollo.
* **Decisiones Pendientes:** `PENDIENTE DE DECISIÓN`: Dictamen normativo, tributario y de asesoría fiscal superior especializada antes de ofrecer, comercializar o poner en servicio el software para terceros por el territorio nacional en relación con la plena conformidad, adaptabilidad contable y cumplimiento en materia del Reglamento VeriFactu (Ley Antifraude de España), el Plan General Contable aplicable por negocio suscriptor y la estricta observancia del Reglamento General de Protección de Datos en materia del tratamiento informático de nóminas y personal laboral transitorio ajeno.

#### Catálogo de Tareas y Estado:
* [ ] **Tarea 8.1 (`PENDIENTE DE DECISIÓN`):** Someter a consulta jurídica, mercantil y tributaria experta el modelo contable relacional antes del despliegue comercial o venta del servicio bajo suscripción en España.
* [ ] **Tarea 8.2:** Programar e inyectar en todas y cada una de las tablas del esquema transaccional en la nube del proveedor elegido la columna de separación organizacional `tenant_id (UUID)`.
* [ ] **Tarea 8.3:** Redactar, probar en entorno aislado de test automatizados (Vitest) y promulgar las sentencias SQL relacionales y políticas soberanas de seguridad de fila (**RLS**) asociadas al token firmado JWT por cada identidad de corporación.
* [ ] **Tarea 8.4:** Diseñar el flujo de alta autocompleto comercial (onboarding) y la consola de gestión de superusuario para administrar con estricto control de auditoría general y trazabilidad del sistema y de suscripción corporativa.
