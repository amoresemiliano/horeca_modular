# 03 - Matriz Ponderada de Decisión Arquitectónica (Fase 2B)

## 1. Metodología de Puntuación Ponderada

Para determinar el encajar y nivel de pertinencia técnico-financiera de las alternativas expuestas, se instituye un sistema de valoración numérica en el que cada criterio es cualificado de **1 a 5** (donde 1 representa incompatibilidad técnica o exposición inaceptable y 5 indica el nivel máximo de alineación con el modelo operativo). Esta calificación se pondera según la trascendencia del criterio para la operatoria gastronómica transaccional de Taquería El Criollo. La suma de los pesos es 100.

Se proscribe expresamente asignar puntuaciones perfectas por meras capacidades teóricas que no se encuentren configuradas, documentando para cada caso la brecha existente entre la capacidad ofrecida por la nube o software y el trabajo pendiente por desarrollar en el código de producción.

## 2. Matriz Ponderada

| Criterio de Evaluación | Peso | Alternativa A <br> *(SPA + Supabase)* | Alternativa B <br> *(Node API + Postgres)* | Alternativa C <br> *(MySQL Bluehost)* | Alternativa D <br> *(Firebase Híbrido)* |
|---|:---:|:---:|:---:|:---:|:---:|
| **1. Seguridad del MVP (RLS / Aislamiento)** | **15** | **4** *(60 pts)* | **4** *(60 pts)* | **2** *(30 pts)* | **4** *(60 pts)* |
| **2. Integridad Relacional y ACID** | **15** | **5** *(75 pts)* | **5** *(75 pts)* | **3** *(45 pts)* | **2** *(30 pts)* |
| **3. Velocidad de Implementación** | **12** | **4** *(48 pts)* | **3** *(36 pts)* | **3** *(36 pts)* | **3** *(36 pts)* |
| **4. Coste Inicial de Puesta en Marcha** | **8** | **5** *(40 pts)* | **3** *(24 pts)* | **5** *(40 pts)* | **4** *(32 pts)* |
| **5. Coste Operativo Futuro y Escalabilidad**| **7** | **4** *(28 pts)* | **3** *(21 pts)* | **4** *(28 pts)* | **3** *(21 pts)* |
| **6. Facilidad de Mantenimiento Operacional**| **10** | **4** *(40 pts)* | **3** *(30 pts)* | **3** *(30 pts)* | **3** *(30 pts)* |
| **7. Backups y Recuperación de Datos** | **8** | **3** *(24 pts)* | **4** *(32 pts)* | **3** *(24 pts)* | **4** *(32 pts)* |
| **8. Almacenamiento Seguro de Originales** | **7** | **4** *(28 pts)* | **4** *(28 pts)* | **2** *(14 pts)* | **4** *(28 pts)* |
| **9. Eficacia en Conciliaciones 1:N y N:M** | **7** | **5** *(35 pts)* | **5** *(35 pts)* | **4** *(28 pts)* | **2** *(14 pts)* |
| **10. Auditoría y Trazabilidad** | **6** | **4** *(24 pts)* | **4** *(24 pts)* | **3** *(18 pts)* | **3** *(18 pts)* |
| **11. Transición a Arquitectura Multi-Tenant**| **5** | **4** *(20 pts)* | **4** *(20 pts)* | **2** *(10 pts)* | **3** *(15 pts)* |
| **PUNTUACIÓN PONDERADA TOTAL** | **100**| **422 / 500 <br> (84.4%)** | **385 / 500 <br> (77.0%)** | **303 / 500 <br> (60.6%)** | **316 / 500 <br> (63.2%)** |

## 3. Análisis Cualitativo y Razones de Puntuación Revisada

### 3.1. Sobre la Alternativa A (SPA + Supabase - 422 puntos / 84.4%)
* **Seguridad del MVP (4/5):** No se otorga la puntuación máxima (5) porque en el estado verificado actual el cliente está utilizando una clave anónima sin integración formal de autenticación verificada; se requerirá redactar políticas RLS reales y configurar el traspaso de identidad para alcanzar el máximo de seguridad.
* **Integridad Relacional (5/5):** Puntuación máxima respaldada por el motor PostgreSQL 15+ subyacente que posibilita claves foráneas estrictas, restricciones de integridad referencial e índices ACID inapelables.
* **Velocidad de Implementación (4/5):** Si bien elimina el esfuerzo de construir una API dedicada para CRUD, se substrae 1 punto respecto a valoraciones ideales debido a la necesidad ineludible de resolver la dualidad de dependencias del actual `package.json` y adaptar los esquemas al nuevo modelo mínimo transitorio.
* **Backups y Recuperación (3/5):** Se puntúa con 3 debido a que en los planes básicos de Supabase la periodicidad del respaldo y la ausencia de restauración punto a punto (*Point in Time Recovery* o PITR) en las capas introductorias obliga a diseñar un plan complementario de exportación externa que compense esta limitación de proveedor en el nivel MVP.
* **Almacenamiento de Originales y Auditoría (4/5):** Suministrado por la plataforma y apto para vincularse al motor SQL, pero condicionado en la puntuación por la necesidad técnica pendiente de crear las reglas específicas del bucket (`Storage Rules`) y las tablas log de trazabilidad transccional no nativas aplicables a HORECA.

### 3.2. Sobre la Alternativa B (SPA + Node API + PostgreSQL VPS - 385 puntos / 77.0%)
* **Seguridad y Auditoría (4/5):** Altamente confiable al residir tras un servidor que actúa de compuerta, con control total sobre middleware del Audit Log.
* **Velocidad de Implementación (3/5) y Costes Iniciales (3/5):** Sufre una merengida rebaja punitiva frente al modelo administrado al exigir programar todas las rutas, validadores e intermedios desde cero (boilerplate masivo), conllevando al mismo tiempo costes económicos directos por contratación y aprovisionamiento dual de instancias computacionales dedicadas desde el día inicial.
* **Backups (4/5):** Mayor versatilidad al permitir programar scripts del sistema o tareas `cron` de exportación de `pg_dump` directo al servidor sin depender del nivel de suscripción del PaaS.

### 3.3. Sobre la Alternativa C (MySQL en Bluehost Compartido - 303 puntos / 60.6%)
* **Seguridad (2/5) y Almacenamiento (2/5):** Penalizado notablemente por las restricciones e inseguridades de un entorno de hosting compartido en cPanel. Guardar reportes contables transaccionales sensibles y extractos en los sistemas de ficheros generales de un entorno de estas características expone la plataforma a riesgos estructurales de configuración web.
* **Integridad Relacional (3/5) y Conciliaciones (4/5):** El motor MySQL es operativo y suficiente para tablas vinculadas en InnoDB, pero resulta menos flexible y eficaz al momento de ejecutar analíticas avanzadas e interpolación transaccional sobre agregados complejos sin reescribir rutinas enteras del motor.
* **Mantenimiento Operacional (3/5):** Sujeta a límites rígidos e inalterables en recursos y cuotas (por ejemplo `memory_limit` de PHP) del hosting que interfieren en el parseo o volcado de decenas de miles de filas transaccionales.

### 3.4. Sobre la Alternativa D (Firebase Híbrido - 316 puntos / 63.2%)
* **Integridad Relacional (2/5) y Conciliaciones 1:N y N:M (2/5):** La ausencia intrínseca de garantías relacionales formales, claves foráneas, restricciones de unicidad combinadas y uniones (*joins*) en el motor NoSQL de Firestore lo convierten en un candidato desfavorable para gestionar contabilidades, cruces de comisiones intermedios e impuestos conciliados simultáneos.
* **Costes Operativos (3/5):** La tarificcación incremental ligada al número absoluto de escrituras, lecturas y modificaciones del modelo de documentos de Firestore genera riesgos imprevisibles de incremento en costes operacionales al iterar o re-procesar periódicamente grandes reportes provenientes del TPV y las diversas plataformas de entrega a domicilio.

---

## 4. Conclusión de la Evaluación
Con un resultado de **422 puntos sobre 500 (84.4%)**, la combinación tecnológica **SPA React/Vite + Supabase/PostgreSQL (Alternativa A)** se califica formalmente y con sobriedad como **ALTERNATIVA PRESELECCIONADA PARA EL MVP**. Su eventual ratificación para producción en el futuro depende de solventar las observaciones relativas a autenticación, backups, y segmentación de datos documentadas en esta misma serie de entregables.
