# 01 - Inventario de Repositorios y Arquitectura Inicial

## 1. Metodología y Nota de Reemplazo

El presente documento actualiza y reemplaza la entrega previa de `01-inventario-repositorios.md`.
**Justificación del Reemplazo:** La versión anterior del documento contenía descripciones genéricas sin verificación exhaustiva de los remotes Git de cada repositorio hermano y utilizaba de manera equívoca los términos `ec-plataforma-maestra` y `el_criollo_modular`. En esta versión se incorpora la evidencia verificada línea a línea para los 9 repositorios y carpetas del workspace, aplicando el criterio de evidencia riguroso (Hechos Verificados, Inferencias y Limitaciones) sin eliminar información arquitectónica válida previa.

## 2. Aclaración de Nombre: `ec-plataforma-maestra` vs `el_criollo_modular`

Durante las fases iniciales se ha utilizado la nomenclatura `ec-plataforma-maestra`, lo que generaba ambigüedad sobre su identidad técnica.
* **HECHO VERIFICADO:** En el archivo `el_criollo_modular/package.json:L2`, la propiedad del paquete npm está declarada exactamente como `"name": "ec-plataforma-maestra"`.
* **HECHO VERIFICADO:** En el sistema local de desarrollo externo al workspace actual, el usuario posee una carpeta denominada `ec-plataforma-maestra/`.
* **INFERENCIA / CONCLUSIÓN TÉCNICA:** `ec-plataforma-maestra` es el **nombre interno de la aplicación (paquete npm)** y del directorio de trabajo en entornos de desarrollo locales externos, mientras que `el_criollo_modular` es el nombre de la carpeta dentro de este workspace y el repositorio remoto de Github (`https://github.com/amoresemiliano/el_criollo_modular.git`). No deben usarse de forma análoga sin especificar si se alude a la carpeta raíz (`el_criollo_modular`) o a la aplicación React (`ec-plataforma-maestra`).

---

## 3. Inventario Completo de Repositorios

A continuación se documentan los 9 repositorios solicitados, inspeccionando su estado real de Git, arquitectura, base de datos y relación con la plataforma principal:

### 3.1. `el_criollo_modular`
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/el_criollo_modular`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/el_criollo_modular.git` (`.git/config:L8`)
* **Rama Actual:** `dev` (`.git/HEAD:L1`)
* **Estado Git:** Modificado (`src/components/MainLayout.jsx` modificado; carpeta no versionada preexistente `app/`).
* **Stack Tecnológico:** React 19.0.0, Vite 6.0.5, Tailwind CSS 4.0.0, Chart.js 4.4.7, PapaParse 5.4.1 (`package.json:L13-L37`).
* **Arquitectura:** Single-Page Application (SPA) modular del lado del cliente.
* **Base de Datos / Persistencia:** Híbrido: Supabase PostgreSQL (`src/lib/supabase.js:L6`) y `localStorage` del navegador para caché o almacenamiento offline.
* **Autenticación:** Firebase Authentication SDK 11.3.1 (`firebaseConfig.js:L15`) usando `signInWithPopup` con Google.
* **Madurez Funcional:** Dispar (módulos conectados a base de datos como Extractos y Horarios convivien con prototipos puramente visuales).
* **Dependencias Core:** `@supabase/supabase-js`, `firebase`, `papaparse`, `chart.js`, `lucide-react`.
* **Secretos / Datos Sensibles:** Uso de variables de entorno públicas (`VITE_SUPABASE_ANON_KEY`, `VITE_FIREBASE_API_KEY`) sin secretos privados incrustados de servidor.
* **Relación con Plataforma Principal:** Es el núcleo y repositorio principal del proyecto modular.

### 3.2. `EC_pedidos` (Carpeta local: `pedidos/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/pedidos`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/orden_compra_WS.git` (`.git/config:L8`)
* **Rama Actual:** `main` (`.git/HEAD:L1`)
* **Estado Git:** Limpio en el workspace actual.
* **Stack Tecnológico:** Frontend en JavaScript clásico/Vanilla (`app.js` 58 KB), HTML5, CSS3, con librería `TomSelect`. Backend en PHP con PDO MySQL.
* **Arquitectura:** Cliente-Servidor clásico (AJAX via Fetch API contra scripts PHP monolíticos en cPanel/BlueHost).
* **Base de Datos / Persistencia:** MySQL (Base de datos remota: `athcomar_comprasWS`).
* **Autenticación:** Login tradicional en PHP verificando hash bcrypt (`login.php:L19`), guardando sesión de usuario de forma insegura en `localStorage` del navegador (`app.js:L86`).
* **Madurez Funcional:** **FUNCIONAL EN PRODUCCIÓN**. Es el sistema de compras actualmente utilizado por la operación de Taquería El Criollo.
* **Dependencias:** `TomSelect` e iconos FontAwesome.
* **Secretos Detectados (CRÍTICO):** Contraseñas reales de acceso a MySQL de producción en texto plano dentro del repositorio (`backend/db_connect.php:L12-L14`). Datos redactados en este informe.
* **Relación con Plataforma Principal:** Sistema operativo heredado que debe ser migrado o integrado de manera progresiva hacia el módulo `PedidosApp.jsx` de `el_criollo_modular`.

### 3.3. `EC_escandallos` (Carpeta local: `escandallos/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/escandallos`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/EC_escandallos.git` (`.git/config:L8`)
* **Rama Actual:** `main` (`.git/HEAD:L1`)
* **Estado Git:** Limpio.
* **Stack Tecnológico:** HTML, CSS y JavaScript Vanilla (`app.js` 2.8 KB).
* **Arquitectura:** Página web estática de prototipado sin servidor.
* **Base de Datos / Persistencia:** Ninguna (datos de recetas y costos en memoria en `app.js`).
* **Autenticación:** Ninguna.
* **Madurez Funcional:** **SOLO FRONTEND / MOCK**. Prototipo estático para cálculo de mermas y costos del Guacamole.
* **Dependencias:** Ninguna externa identificada en servidor.
* **Secretos Detectados:** Ninguno.
* **Relación con Plataforma Principal:** Precedente conceptual de `src/modules/escandallos/EscandallosApp.jsx`.

### 3.4. `EC_inventario` (Carpeta local: `inventario/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/inventario`
* **Repositorio Git Remoto:** La carpeta raíz contiene 15 carpetas de versiones (`warehouse_v1` a `v11`, `v12` a `v14`). Dentro del subdirectorio `inventory-app/`, el remoto Git es: `https://github.com/amoresemiliano/sistema_inventarios` (`inventory-app/.git/config:L8`).
* **Rama Actual:** `main` (`inventory-app/.git/HEAD:L1`).
* **Estado Git:** Limpio.
* **Stack Tecnológico:** En las versiones antiguas (`warehouse_v*`), PHP + MySQL. En la versión moderna (`inventory-app`), React + Vite (`inventory-app/package.json:L1`).
* **Arquitectura:** Híbrido evolutivo de scripts PHP monoliticos y frontend React moderno en desarrollo.
* **Base de Datos:** MySQL (según volcado `athcomar_inventario_el_criollo.sql`).
* **Autenticación:** Tabla de usuarios SQL con roles `admin`, `usuario`, `cocina`.
* **Madurez Funcional:** **PARCIAL**. Sistema operativo en fases iterativas de diseño, cuya capa de lógica actual en la plataforma modular se apoya al 100% en `localStorage`.
* **Secretos Detectados:** El volcado SQL vinculado contiene hashes y correos de usuarios reales de producción (anonimizados en reportes).
* **Relación con Plataforma Principal:** Sistema logístico de referencia que requiere migración hacia Supabase en `el_criollo_modular`.

### 3.5. `EC_kpis` (Carpeta local: `kpis/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/kpis`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/EC_kpis.git` (`.git/config:L8`)
* **Rama Actual:** `main` (`.git/HEAD:L1`)
* **Estado Git:** Limpio (contiene subcarpetas iterativas `v1.0.0` a `v1.0.3`).
* **Stack Tecnológico:** HTML, CSS y JavaScript Vanilla.
* **Arquitectura:** Interfaz web estática por versiones.
* **Base de Datos:** Ninguna (simuladores mediante carga local de ficheros CSV).
* **Autenticación:** Ninguna.
* **Madurez Funcional:** **MOCK / SOLO FRONTEND**.
* **Secretos Detectados:** Ninguno.
* **Relación con Plataforma Principal:** Maqueta visual e interfaz trasladada al módulo `src/modules/kpis/KpisApp.jsx`.

### 3.6. `EC_prediccion` (Carpeta local: `prediccion/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/prediccion`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/EC_prediccion.git` (`.git/config:L8`)
* **Rama Actual:** `main` (`.git/HEAD:L1`)
* **Estado Git:** Limpio (contiene versiones `v1.0`, `v1.1` y archivo de documentación `Site Map.odt`).
* **Stack Tecnológico:** HTML, CSS, JS clásico.
* **Arquitectura:** Prototipo estático del lado del cliente.
* **Base de Datos:** Ninguna (interfaz para adjuntar archivos CSV de ventas históricas e inventario).
* **Autenticación:** Ninguna.
* **Madurez Funcional:** **SOLO FRONTEND / MOCK**.
* **Secretos Detectados:** Ninguno.
* **Relación con Plataforma Principal:** Maquetación para el módulo de recomendaciones de compra `src/modules/prediccion/PrediccionApp.jsx`.

### 3.7. `EC_extractos` (Carpeta local: `extractos/`)
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/extractos`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/EC_extractos.git` (`.git/config:L8`)
* **Rama Actual:** `main` (`.git/HEAD:L1`)
* **Estado Git:** Limpio (contiene 8 carpetas históricas de evolución: `v1.0` hasta `v1.7`).
* **Stack Tecnológico:** HTML, CSS, JavaScript con PapaParse y librerías visuales en versiones finales.
* **Arquitectura:** Evolución de prototipos frontend.
* **Base de Datos:** Inicialmente `localStorage`, migrado con posterioridad al modelo en nube en el repositorio modular.
* **Autenticación:** Ninguna incorporada de forma nativa en este repositorio independiente.
* **Madurez Funcional:** **FUNCIONAL HISTÓRICO / PARCIAL**.
* **Secretos Detectados:** Ninguno.
* **Relación con Plataforma Principal:** Origen evolutivo del módulo core `src/modules/extractos/ExtractosApp.jsx`.

### 3.8. `last_API`
* **Ruta Local:** `C:/Users/Emiliano/Documents/1. Sistemas/El Criollo/el-criollo-ecosistema/last_API`
* **Repositorio Git Remoto:** `https://github.com/amoresemiliano/last_API` (`.git/config:L8`)
* **Rama Actual:** `dev` (`.git/HEAD:L1`)
* **Estado Git:** Limpio.
* **Stack Tecnológico:** Backend Node.js / Express / Socket.IO / MySQL2 / Firebase Admin SDK (`backend/src/server.js:L1-L7`). Frontend independiente en React / Vite / Tailwind (`frontend/package.json`).
* **Arquitectura:** Aplicación full-stack con servidor en puerto 3001, escuchando webhooks para integración TPV y despachando eventos WebSockets en tiempo real (`server.js:L27, L324`).
* **Base de Datos:** MySQL (base remota y volcado `athcomar_vegen_Last_API.sql`).
* **Autenticación:** Tokens Bearer verificados con Firebase Admin SDK (`verifyIdToken` en `server.js:L72`).
* **Madurez Funcional:** **FUNCIONAL (Backend & API Real-Time)**. Integración y motor analítico para datos del TPV Last.app y matriz BCG (Boston Consulting Group).
* **Dependencias:** `express`, `socket.io`, `mysql2`, `firebase-admin`, `cors`, `dotenv`.
* **Secretos Detectados (CRÍTICO):** Fichero `.env` de backend versionado en Git conteniendo usuario de base de datos MySQL y contraseña de producción (`backend/.env:L4-L6`). Datos redactados por seguridad.
* **Relación con Plataforma Principal:** Motor backend avanzado y puente de datos que debe alimentar los módulos de `Ventas`, `KPIs` y `Predicción` de la plataforma maestra sin recurrir a cargas CSV manuales.

### 3.9. `stocksystem_ec`
* **Estado:** **NO DISPONIBLE**.
* **Nota Técnica:** No se encuentra como directorio ni como submódulo dentro del espacio de trabajo autorizado `el-criollo-ecosistema/`. Toda consulta u opinión sobre este componente incurriría en especulación teórica no sustentada en evidencia auditada.
