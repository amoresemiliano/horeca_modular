# WP-PERS-002 — Personal persistente y recordatorios

Inspección y pruebas: 11 de noviembre de 2026; informe actualizado el 12 de
noviembre de 2026, Europe/Madrid. Estado: implementación local;
**DEV/UAT no operativo todavía**. No se declara aceptación ni entrega terminada.

## Referencias verificadas con fetch

| Referencia | SHA |
| --- | --- |
| Inicio / origin/module/personnel | ec765a1f580236e5f8bee2d5e70a0dbb5e00fe49 |
| origin/dev | e9423023a656244fb2d30b65920c6091fd48784f |
| origin/main | 04cfc8238c0a7a2cf310e3bbccdd565bd9d072b3 |

DEV es ancestro del punto de partida. Se revisó el diff de la rama; no hay trabajo
posterior de DEV que incorporar en esta inspección. No se ha integrado ni publicado
esta entrega en DEV o main. `module/personnel` conserva su despliegue automático
deshabilitado. Producción no se ha modificado.

## Bloqueos externos y de Core

El CLI de Supabase identifica el proyecto canónico `vmxjqwlfwnphorthhcwu` como
`INACTIVE`. Dos intentos SQL terminaron en HTTP 544 al crear el login temporal:
`Connection terminated due to connection timeout`. El mecanismo anterior de claves
API tampoco devolvió las claves legacy necesarias. Se solicitó al PO decidir sobre
la reactivación del servicio compartido, que puede reanudar facturación. No se
reactiva sin esa decisión. No se sustituyó por otro proyecto.

Por tanto, **no se pudo confirmar el historial remoto de migraciones ni las
colisiones contra la base real**. No se aplicó ninguna migración, entitlement,
rol, secreto de Vercel o fixture remoto. El Criollo y Taquería Maravillas permanecen
sin cambios por este WP. No se han creado empleados reales ni sintéticos remotos.

`src/domain/tenancy/authorization/roles.ts` asigna a `HR_PERSONNEL`
`reporting.operational.view`. `src/application/tenancy/accessNavigation.js` permite
Dashboard y KPI con ese permiso y entitlement `reporting`, y Predicción con
entitlement `prediccion`. Por ello el rol base **no garantiza navegación solo
Personal** cuando estos entitlements están habilitados. Falta contrastar el estado
remoto. Se detienen las asignaciones de este rol: no se modifican sus semánticas,
no se revocan permisos globales ni se introducen excepciones por tenant/email.
La solución necesita decisión de Core antes de asignar personal con acceso exclusivo.

Vercel se inspeccionó con su sesión CLI actual: el despliegue DEV READY corresponde
a `e9423023a656244fb2d30b65920c6091fd48784f`; faltan las variables de Personal.
La evidencia de metadatos no contiene valores secretos.

## Reconciliación de AI Studio

Se compararon directamente los seis componentes de referencia solicitados. No se
importa el shell, contexto, permisos, servicios simulados ni maestros de referencia.

| Referencia AI Studio | Implementación conectada a API de HORECA |
| --- | --- |
| TodayDashboard | Attendance en modo Hoy: tarjetas filtrables, previstos/reales, finalizados, falta de salida; sin inventar ausencias ni incidencias |
| AttendanceAdminView | Periodo hoy/semana completa/rango, empleado, estado y unidad canónica; desviaciones y duración; tarjetas adaptables |
| ScheduleView | `personnel-live/schedule/ScheduleView.jsx`: semana/lista, navegación, edición y cancelación futuras, indicadores nocturnos |
| EmployeeDirectoryView | `personnel-live/employees/EmployeeDirectory.jsx`: búsqueda, creación, edición/desactivación, PIN y turnos |
| EmployeeDetailView | Resumen, Asistencia y Horarios; datos laborales/contacto/unidades/PIN reales; secciones futuras explícitamente pendientes |
| KioskClockInView | PunchApp aislada: PIN, teclado, confirmación de servidor, observación y reinicio; instalación Android/iOS |

MainLayout tiene una sola ruta de Personal, persistente, sin bandera oculta ni
fallback a fixtures. Los componentes de proyección/controles/CSS validados se
reutilizan. El prototipo y `personnel-ai-studio/` quedan como referencias fuera de
esa ruta. Se mantienen shell, tokens y autorización de HORECA. La entrada PWA no
importa AuthContext, MainLayout, directorio o estado administrativo.

Los rangos de asistencia solicitan datos al servidor; navegar semanas solicita el
periodo correspondiente. Hoy incluye el turno nocturno que termina en la fecha
de la unidad. Hay actualización periódica visible. La tardanza se define por
`isLateArrival` y `ATTENDANCE_POLICY`: comparación estricta de instantes, tolerancia
inicial cero; el redondeo visual de minutos no altera el estado de retraso.

## Push y scheduler

`20261111100000_personnel_push_reminders.sql` es aditiva, sin semillas ni activación
automática de tenants. Define suscripciones, preferencias, política y entregas en
`personnel_private`, con RLS y sin permisos de navegador. Se conserva la fundación
de WP-PERS-001, scrypt/pepper, permisos de un uso, throttling e invalidación por
reset de PIN. Asociar recordatorios exige dispositivo autorizado y verificación
actual del PIN sin registrar asistencia. No se devuelve identidad, roster ni claves
privadas en la consulta de estado.

Cada móvil tiene una asociación de empleado. Un mismo endpoint no queda activo
en dos dispositivos. Reactivar el móvil desactiva atómicamente su asociación previa
antes de emitir la nueva cookie. Se indica que los recordatorios son para un móvil
personal, no un terminal compartido. Desactivar borra endpoint/claves del registro
activo; respuestas 404/410 del proveedor también invalidan la suscripción.

El cliente detecta serviceWorker, PushManager y Notification. El permiso solo se
solicita al pulsar Activar recordatorios, nunca al cargar. Falta de soporte,
configuración o permiso no bloquea IN/OUT. El service worker solo cachea la
explicación estática offline; no encola fichajes ni cachea API/datos/credenciales.
Click de notificación siempre abre `/personal/fichaje/`, ignorando URLs del payload.

El endpoint GET `/api/personnel-reminders` exige `PERSONNEL_CRON_SECRET`. El job usa
instantes persistidos de la zona del turno y comprueba política, tenant/unidad,
asignación, empleado, dispositivo, preferencias, correcciones y fichajes actuales.
ENTRY se evalúa desde tres minutos antes hasta el inicio; START al inicio y EXIT al
final tienen ventana de evaluación de dos minutos. ENTRY/START no se envían con
entrada válida; EXIT requiere sesión abierta y no se envía tras salida válida.
Se comprueba otra vez justo antes del envío. Cada claim es único por suscripción,
turno, revisión y tipo; se procesa un lote acotado de 20. Resultado persistido:
SENT, FAILED o SKIPPED; un crash puede dejar CLAIMED. No hay reenvío automático de
resultados inciertos, para evitar duplicados; esto prioriza como máximo un intento
frente a garantizar entrega. Existe una carrera inevitable si alguien ficha entre
la última comprobación y la recepción del push, con TTL de 60 segundos.

El transporte usa `web-push` y VAPID exclusivamente en servidor; se validan claves
EC y destinos de proveedores HTTPS para impedir SSRF. Variables requeridas:
`PERSONNEL_VAPID_PUBLIC_KEY`, `PERSONNEL_VAPID_PRIVATE_KEY`,
`PERSONNEL_VAPID_SUBJECT`, `PERSONNEL_CRON_SECRET`, además de las variables backend
de WP-PERS-001. No se han generado ni instalado secretos remotos en este WP.

Vercel cron de producción no sirve para ejecutar este UAT de preview sin modificar
main. Se proporciona `scripts/personnel-dev-scheduler.sql`: pg_cron/pg_net llama
cada minuto al endpoint DEV, con origen y autorización obtenidos de Vault. Su
ejecución requiere comprobar extensiones y provisionar ambos secretos de Vault.
El script falla si faltan requisitos; **no se ha instalado ni activado el job**.

Referencias técnicas: [PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe),
[web-push](https://github.com/web-push-libs/web-push),
[Vercel cron](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs).

## Secuencia restante de integración controlada

1. Tras decisión del PO, reactivar exclusivamente el proyecto canónico y repetir
   fetch, historial, colisiones, prerequisitos, constraints, RLS y auditoría de Core.
2. Capturar huellas agregadas de tablas protegidas y before-image de entitlements.
   Revisar las dos migraciones en orden; su SQL se prueba en PostgreSQL efímero.
   No ejecutar un push indiscriminado de todas las migraciones pendientes.
3. Aplicar fundación y push, registrar historial y comprobar RLS/permisos. No crear
   empleados. Recuperación operacional: desactivar backend/política/cron, conservar
   datos e historial; no DROP/reset/cleanup. Un fallo de migración transaccional
   revierte su transacción. Contrastar huellas de dominios protegidos.
4. Habilitar entitlement Personal solo para El Criollo; DEV LAB únicamente si se
   necesita validación técnica. No cambiar Maravillas ni otros entitlements.
5. Resolver el desajuste específico de Core antes de asignar acceso solo Personal.
   Mantener los permisos amplios existentes del PO.
6. Provisionar secretos de servidor solo para DEV. Integrar el diff revisado en
   DEV con revisión final de referencias, desplegar y registrar SHA y URL exactos.
7. Instalar el scheduler DEV; ejecutar pruebas hosted de RLS/API/dispositivos y
   entrega real push con datos de DEV LAB. Verificar suscripción y resultado de
   entrega; no confundir pruebas simuladas con recepción real en teléfono.
8. El PO crea manualmente el primer empleado de El Criollo, su turno futuro,
   PIN y activación; abre el enlace de un uso en el móvil e instala la PWA desde
   Android o Safari → Compartir → Añadir a pantalla de inicio. Verifica IN/OUT en
   Hoy/Asistencia y opt-in push. QR no incluido; el enlace es funcional.

## Validación

Resultados y límites en `docs/evidence/wp-pers-002/`. Las pruebas de navegador son
locales con API simulada y etiquetas sintéticas; las pruebas PostgreSQL usan PGlite
efímero con migraciones reales. No se declara una prueba hosted ni entrega push
real, ni instalación física Android/iPhone. Estos son criterios todavía pendientes.
La primera suite paralela agotó tiempos por contención; se repitió con un worker,
como en WP-PERS-001, sin aumentar timeouts ni cambiar aserciones de otros dominios.

Resultado final: 58 archivos de pruebas aprobados; 730 pruebas aprobadas y una
omitida. Lint sin errores y con seis avisos preexistentes; typecheck y build
aprobados. Administrador y PWA sin desbordamiento en 375, 390, 430, 768, 1024 y
1440. Los scripts actuales son `tests/personal/wp-pers002-browser.mjs` y
`tests/personal/wp-pers002-pwa-browser.mjs`; los scripts de publicación del
prototipo anterior no acreditan esta entrega.
