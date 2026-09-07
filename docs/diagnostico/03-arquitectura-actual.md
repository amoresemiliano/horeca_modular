# 03 - Arquitectura Actual del Ecosistema

## 1. Topología y Modelo Arquitectónico

La arquitectura actual del ecosistema de Taquería El Criollo es **híbrida y descentralizada**, distribuyendo la carga operativa y lógica en tres sistemas técnicos independientes que interactúan entre sí mediante exportación manual de ficheros y enlaces de transporte web:

```mermaid
graph TD
    subgraph "Entorno Cliente (Navegador Local)"
        SPA["el_criollo_modular<br>(SPA: React 19 + Vite 6 + Tailwind 4)"]
        LS[("Almacén Local<br>Browser localStorage<br>• criollo_* (Inventario)<br>• vdc_permisos (Roles)<br>• db_extractos (Offline Cache)")]
        LEGACY["EC_pedidos Frontend<br>(JS Clásico + TomSelect + Fetch)"]
    end

    subgraph "Capa BaaS & Cloud (Servicios Remotos)"
        FB_AUTH["Firebase Auth<br>(Google Login Provider)"]
        SUPABASE[("Supabase PostgreSQL DB<br>Tablas:<br>• extractos<br>• empleados / fichajes<br>• produccion_registros")]
    end

    subgraph "Servidor Monolítico Legacy (BlueHost / cPanel)"
        PHP_API["APIs PHP Monolíticas<br>(orders.php, login.php, products.php)"]
        MYSQL_COMPRAS[("MySQL DB<br>(athcomar_comprasWS)")]
    end

    subgraph "Servidor Analítico TPV (Node.js / Express)"
        LAST_SRV["last_API Backend<br>(Puerto 3001 / Express + Socket.IO)"]
        MYSQL_LAST[("MySQL DB<br>(athcomar_vegen_Last_API)")]
        TPV["Last.app POS / TPV<br>(Webhooks & CSV Exports)"]
    end

    %% Conexiones
    SPA -->|1. Login Google| FB_AUTH
    SPA <-->|2. CRUD Tablas Activas (Sin RLS)| SUPABASE
    SPA <-->|3. Lectura/Escritura Módulos Mocks| LS

    LEGACY -->|4. AJAX HTTP Requests| PHP_API
    PHP_API <-->|5. PDO SQL queries| MYSQL_COMPRAS

    TPV -->|6. Webhook Post / Carga CSV| LAST_SRV
    LAST_SRV <-->|7. Consultas y Persistencia| MYSQL_LAST
    LAST_SRV -->|8. Firebase Verify ID Token| FB_AUTH
```

---

## 2. Radiografía de Componentes Centrales

### 2.1. Núcleo SPA: `el_criollo_modular`
* **HECHO VERIFICADO:** Desarrollado como Single-Page Application sobre React 19 (`el_criollo_modular/package.json:L19`). El enrutamiento entre pantallas se opera como pestañas en un estado React gestionado en `MainLayout.jsx:L65` (`const [tabActiva, setTabActiva] = useState('Consolidado')`), eludiendo navegaciones completas.
* **HECHO VERIFICADO:** La capa de persistencia se fragmenta. Los módulos `Extractos`, `Horarios` y `Producción` invocan directamente al cliente `@supabase/supabase-js` (`src/lib/supabase.js:L6`). Por el contrario, el módulo `Inventario` confía totalmente en un hook personalizado `usePersistedState` (`src/modules/inventario/store/store.jsx:L80-L107`) que lee y escribe exclusivamente en la memoria `localStorage` del navegador con prefijo `criollo_*`.

### 2.2. Sistema de Compras Legacy: `EC_pedidos`
* **HECHO VERIFICADO:** Operado mediante JavaScript tradicional desde `pedidos/app.js`, que invoca scripts PHP independientes ubicados en el backend (`login.php`, `orders.php`, `products.php`).
* **HECHO VERIFICADO:** Conexión persistente mediante PDO de PHP hacia el motor MySQL local en cPanel/BlueHost (`db_connect.php:L17`). La autenticación no es basada en tokens sin estado (Stateless Token) sino en una respuesta JSON de verificación de contraseña bcrypt (`login.php:L19`), tras la cual el frontend deposita la sesión en `localStorage.setItem('loggedUser', ...)` (`app.js:L86`).

### 2.3. Motor de Integración TPV: `last_API`
* **HECHO VERIFICADO:** Servidor en Node.js y Express (`last_API/backend/src/server.js:L25-L42`) que implementa un pool de conexiones `mysql2/promise` hacia la base de datos `athcomar_vegen_Last_API` y habilita un servidor WebSocket con `socket.io`.
* **HECHO VERIFICADO:** A diferencia de la SPA maestra, este servidor sí aplica validación criptográfica del token del usuario mediante Firebase Admin SDK (`admin.auth().verifyIdToken(token)` en `server.js:L72`) antes de autorizar endpoints protegidos por `/api/`.
* **HECHO VERIFICADO:** Su endpoint de captura en tiempo real (`app.post('/webhook/lastapp', ...)` en `server.js:L324`) es totalmente público, carece de validación de firma y se limita a retransmitir el objeto recibido al canal WebSocket sin persistirlo en la base de datos MySQL.

---

## 3. Conclusión de Ingeniería Arquitectónica

* **INFERENCIA:** La coexistencia de tres motores de base de datos (PostgreSQL en Supabase + 2 instancias MySQL separadas en BlueHost y servidores Node) junto con el uso extensivo de `localStorage` para el módulo operativo clave (Inventario), genera un ecosistema fragmentado, con elevados riesgos de inconsistencia referencial e inapropiado en su estado actual para escalar a un servicio Multi-Tenant corporativo.
