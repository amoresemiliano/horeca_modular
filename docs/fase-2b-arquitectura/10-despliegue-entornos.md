# 10 - Estrategia y Delimitación del Despliegue en Entornos Aislados (Fase 2B)

## 1. Principio de Aislamiento por Entornos

Para salvaguardar de forma inquebrantable el cumplimiento operativo de la **Regla de Oro** (mantener en todo instante libre de interrupciones o afectaciones colaterales la operatividad del servicio HORECA operado), se formula e instituye una estructura estricta de segmentación por tres entornos computacionales escindidos de manera recíproca. Queda prohibido mezclar en el mismo almacén o servidor web registros correspondientes a fases en experimentación transitoria con bases de datos en explotación real o terminales HORECA en sala operados por el personal.

---

## 2. Definición y Especificaciones Técnico-Operativas por Entorno

```mermaid
flowchart TD
    subgraph E_DEV [Entorno de Desarrollo y Laboratorios]
        DEV_CODE["Código Local / labs/import-preview"] -->|Ejecución| DEV_ENGINE[Node CLI / Browser Scratch]
    end
    subgraph E_STAGING [Entorno Staging / Preproducción (Fase 2C / Pruebas)]
        STG_SPA[SPA Vite - Staging Web] -->|Conexión Aislada| STG_SUPA[Proyecto Supabase Staging]
        STG_SUPA -.- STG_DB[(PostgreSQL Pruebas / BD Temporal)]
    end
    subgraph E_PROD [Entorno Productivo Operado (HORECA ERP inalterado)]
        PROD_SPA[SPA Vite - Producción (App.jsx inalterada)] -->|Sesiones Sala| PROD_FIRE[Firebase Auth Activo]
        PROD_SPA -->|Integración Pos-Staging| PROD_SUPA[(Supabase BD Oficial - Hub Económico)]
    end
    subgraph E_CLIENT [Portal del Cliente / Menú Digital (Independiente)]
        APP_STATIC["el_criollo_modular/app/ (Vanilla JS)"] -->|Deploy Escindido| SERVER_WEB[Web Pública Comensales]
    end

    E_DEV -.-|Validación de código y librerías| E_STAGING
    E_STAGING -.-|Aprobación de GO / NO-GO sin interrupción| E_PROD
```

### 2.1. Entorno de Desarrollo y Laboratorios (Desarrollo Local)
* **Objetivo:** Creación e inspección preliminar de parsers y librerías por parte de los ingenieros de desarrollo en entornos locales computacionales, ejecutando pruebas sintácticas, análisis y comprobaciones de código en el directorio `labs/import-preview/`.
* **Conectividad:** Desvinculado de redes o servidores transaccionales operativos mercantiles. Ningún comando de terminal ni prueba local ejecutada por el ingeniero afectará en lo absoluto esquemas o almacenes operados que puedan dar soporte al transaccional TPV de sala de Taquería El Criollo.

### 2.2. Entorno Staging / Pre-producción (Puesta a Punto de Fase 2C)
* **Objetivo:** Aprovisionamiento del espacio verificable en nube para concretar de manera rigurosa y no lesiva la ejecución plena del plan de pruebas intensivas y de endurecimiento técnico prescrito para la venidera **Fase 2C**.
* **Configuración Relacional:** Instanciación en un proyecto o base de datos temporalmente aislado y dedicado en exclusivo a Staging, habilitado en la plataforma en la nube preseleccionada para verificar in situ la carga real de informes y ficheros mercantiles y operacionales sin el menor riesgo colateral, comprobando experimentalmente la resiliencia técnica de los esquemas mínimos propuestos antes de proponer su despliegue oficial productivo.
* **Segregación del Login:** Sujeto a la adopción y verificación probada de la convivencia adaptativa de sesiones sin forzar un corte intemperivo del acceso de usuarios vigentes al ERP principal, confirmando y puliendo cada control de seguridad con datos probados en su integridad por observadores HORECA habilitados y el técnico de desarrollo.

### 2.3. Entorno Producción (ERP HORECA en Vivo - Taquería El Criollo / Vegen Digital SL)
* **Objetivo:** Infraestructura donde opera en tiempo real el personal HORECA de sala del restaurante y administración, apoyado inalterablemente en el servicio transaccional incesante que atiende las comandas, cajas, facturaciones y reportes oficiales corporativos de la empresa.
* **Política de Cuidado Operacional:** Los despliegues de módulos o actualizaciones hacia este entorno se realizarán únicamente tras haber recabado de manera fehaciente dictámenes favorables de homologación transcurridos sobre la etapa en Staging y con autorización explícita directiva.
* **Transición del Prototipo Anterior:** La implantación final del motor de ingesta multicata se ejecutará agregando las tablas relacionales consolidadas en paralelo en la nube, conviviendo progresivamente durante un lapso transitorio de homologación dual sin truncar al instante ni desajustar el prototipo anterior o tabla `extractos` original ni comprometer la usabilidad in situ del TPV del local hasta ratificar y consolidar transaccionalmente y sin fallas el reemplazo transaccional de extremo a extremo sin detenciones operacionales ni tiempos muertos de desconexión obligatoria.

---

## 3. Delimitación Estricta del Portal del Cliente (`app/`) frente al ERP Interno (`src/`)

Con el propósito de descartar confusiones o despliegues incongruentes al automatizar u organizar los servicios web contratados por el operador gastronómico, se define de forma concluyente la línea divisoria arquitectónica entre la aplicación y carta para los comensales frente al motor de gestión interna del negocio.
* **Naturaleza del Directorio `app/` (Portal del Comensal y Carta Interactiva de Sala):**
  El subdirectorio `el_criollo_modular/app/` compendia una interfaz en lenguajes web estéticos puros desasociada por completo de lógicas transaccionales ERP, cuya responsabilidad y cometido web se circunscribe a exhibir y presentar videos gastronómicos, menús interactivos al consumidor y enlaces a proveedores externos en función del local del usuario.
* **Prohibición de Emulsión o Unificación de Ficheros y Rutas de Despliegue:**
  Es absolutamente irregular empaquetar de manera uniforme o superponer indiscriminadamente el contenido transaccional o el código, variables ocultas o rutinas relativas al Hub Económico HORECA (`src/modules/extractos/`) al lado, en subrutas directas sin protección perimetral o entre los ficheros de servicio público estático dedicados en exclusiva para la consulta de comensales. Sus directivas de despliegue sobre los dominios institucionales de **Vegen Digital SL** se mantendrán inequívoca e irrenunciablemente desvinculadas tanto en la estructura de almacenamiento local de servidores como en la resolución y balanceo web aplicados por Internet en todo momento.
