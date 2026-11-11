# Personal — prototipo integrado

> Scope: this document preserves the validated synthetic prototype. WP-PERS-001
> adds separate production adapters and an **unapplied** attendance migration;
> see [WP-PERS-001](../../../docs/WP-PERS-001.md) and
> [current production readiness](../../../docs/PERSONNEL-PRODUCTION-READINESS.md).
> The historical prototype statements below do not describe live enablement.

## Abrir

En la raíz de `el_criollo_modular`, ejecutar `npm run dev`. Iniciar sesión normalmente, seleccionar organización/unidad autorizadas y abrir **Personal**. Se conservan el shell, la marca, la autenticación y el evaluador Core. Son necesarios el entitlement `personal` y una capacidad existente de Personal; no se crean grants ni se alteran roles.

En desarrollo se muestra el prototipo. `npm run build` conserva el módulo anterior en producción; solo `VITE_PERSONNEL_PROTOTYPE=true` selecciona explícitamente el prototipo para una compilación de preview. Ese flag no implementa ni habilita un backend de RR. HH.

Para revisión visual sin cuenta ni servicios externos, el harness de pruebas monta **el mismo MainLayout y PersonnelApp** con un adaptador de autenticación exclusivamente de test:

```sh
node node_modules/vite/bin/vite.js --config tests/personal/vite.config.mjs
```

Abrir `http://127.0.0.1:5194/`. `/?punch-only` demuestra la vista limitada al permiso de fichaje. No existe bypass de autenticación en el entry de la aplicación. Este servidor de test no forma parte del build ni del despliegue.

## Pantallas y recorridos

- **Hoy**: programados, presentes, retrasos, ausentes, incidencias; tarjetas con horario previsto/real y detalle de jornada.
- **Asistencia**: empleado, estado, periodo y rango de fechas; diferencias y horas derivadas; originales, observaciones y correcciones atribuidas.
- **Horarios**: semana/lista, crear/editar turno y copiar semana anterior sin sustituir turnos existentes. Rechaza solapamientos; admite fin al día siguiente.
- **Incidencias**: crear, asociar empleado/día/turno, adjunto simulado, tipos ampliables y resolución.
- **Ausencias**: fechas, parcial/completa, justificante simulado, estado y revisión/aprobación; administración de tipos con activo, aprobación, justificante y retribución.
- **Empleados**: búsqueda, puesto, estado y unidad; alta, edición, desactivación sin borrar historial, asignación a varias unidades y perfil con Resumen, Asistencia, Ausencias, Incidencias, Nóminas y Documentos.
- **Documentos/nóminas**: metadatos, archivo de ejemplo, aviso de privacidad y notificación. Descarga un texto claramente sintético, nunca el archivo seleccionado.
- **Notificaciones**: composición WhatsApp/email y estado simulado, sin contacto ni proveedor.
- **Fichaje**: Empleados → ficha → Crear PIN → anotar el código mostrado una vez → Abrir terminal de fichaje. Teclado de cuatro dígitos, entrada/salida automática, observación opcional y limpieza automática. No hay lista de empleados ni navegación administrativa en el terminal. Bloquear terminal cierra la sesión.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `domain.js` | Proyecciones puras, intervalos, estados, tiempo de unidad y diferencias. |
| `fixtures.js` | Escenario exclusivamente sintético de dos unidades; no son identidades operativas reales. |
| `services.js` | Servicio de aplicación en memoria; validaciones, eventos/correcciones, PIN demo y puertos de notificación/almacenamiento. |
| `PersonnelApp.jsx` | Composición de pantallas y aislamiento de sesión por contexto Core. |
| `Attendance.jsx` | Hoy, asistencia, detalle e interfaz de horarios. |
| `Records.jsx` | Directorio, ausencias, incidencias, documentos y nóminas. |
| `EmployeeProfile.jsx` | Perfil progresivo y secciones restringidas a administración. |
| `Editors.jsx` | Formularios, revisión, tipos, PIN y comunicación simulada. |
| `Kiosk.jsx` | Pantalla exclusiva de terminal y teclado táctil. |
| `ui.jsx` | Campos con etiqueta asociada, diálogo modal nativo, badges y estados vacíos. |
| `personal.css` | Estilos con scope, tokens existentes y adaptación móvil. |

Integración mínima en `src/components/MainLayout.jsx`; flag explicado en `.env.example`. Pruebas en `tests/unit/personnel_prototype.test.js` y `tests/personal/`. No se modifica el módulo anterior ni los contratos Core.

## Supuestos y límites de la simulación

El escenario de validación usa el **6 de noviembre de 2026 a las 12:00 en la unidad de referencia**, de forma explícita y estable. El terminal registra instantes actuales usando la zona configurada de la unidad sintética. Los fichajes sin turno se muestran aparte. Los filtros «Hoy» y «Esta semana» operan sobre el escenario, no sobre un reloj de producción. Las unidades demo no conceden acceso a unidades reales.

Todo vive en memoria: recargar, cambiar de organización/unidad Core o salir del módulo descarta cambios y credenciales. Los nombres de archivos seleccionados se conservan como metadatos; no se leen ni retienen sus binarios. Los contactos de ejemplo son vacíos o `example.invalid`; no se ejecutan llamadas de red desde estos servicios.

Se usa el permiso canónico existente `personnel.employees.manage` para la administración completa y `personnel.fichajes.write` para el terminal. El prototipo no define permisos nuevos de nóminas/documentos ni pretende sustituir la autorización de backend. Los campos de puesto/contrato son opciones demo; la producción necesita catálogos propios del dominio.

La UI incluye estados vacío, carga, error/reintento y feedback de éxito. En móvil usa tarjetas, controles de al menos 44 px, teclado de 66 px y navegación local; en escritorio conserva el sidebar. Los ajustes del shell solo se aplican a Personal cuando el prototipo está seleccionado. Los diálogos ofrecen foco nativo, Escape y retorno al elemento que los abrió.

## Entrega posterior de backend

1. **Supabase/Postgres** sigue siendo canónico: empleados distintos de usuarios, historial laboral y asignaciones, horarios, punches append-only, correcciones, ausencias/tipos, incidencias/tipos, nóminas, documentos y comunicaciones. Toda entidad requiere alcance organizativo y de unidad donde corresponda.
2. Materializar permisos Core y RLS por tenant/unidad y lecturas sensibles de nóminas/identidad/documentos. La selección de una unidad en cliente nunca acredita autoridad. Mantener entitlement más capacidades; cualquier acceso/revoke se verifica en servidor.
3. Sustituir la verificación PIN local por backend con dispositivo autorizado independiente de administración, PIN con hash de contraseñas adecuado, secreto de servidor, unicidad/lookup seguros, límites distribuidos, auditoría de intentos, revocación e idempotencia transaccional. El hash SHA-256 con salt y el throttle en memoria de este mock **no son una implementación de seguridad de producción**. Un PIN de empleado no es una cuenta de aplicación.
4. Persistir instantes y zona de unidad; precisar turnos múltiples/partidos, pausa, sesiones nocturnas, corrección de sesiones abiertas y semántica de ausencias parciales. El prototipo rechaza horas inexistentes por DST; la elección explícita de offset durante la repetición de hora otoñal queda pendiente del contrato productivo.
5. Implementar `PersonnelDocumentStoragePort` detrás de API autenticada/autorizada, con un futuro `BluehostPersonnelDocumentStorageAdapter`: almacenamiento privado, límites/validación, referencia opaca en Supabase y descarga controlada. El frontend no escribe en Bluehost y no conoce rutas ni credenciales.
6. Implementar `PersonnelNotificationService` con proveedor oficial WhatsApp/email, consentimiento/política del producto, estado de entrega y auditoría. La simulación no acredita envío. No se activa deep-link ni proveedor real.
7. Nóminas almacenan importes informados/PDF; no hay motor de cálculo oficial. Definir retención, auditoría y granularidad de lectura antes de usar datos sensibles reales.

Las fases de entrega productiva pueden empezar por empleado/turno/PIN/fichajes/seguimiento diario sin ocultar los flujos posteriores en este prototipo.

## Verificación y capturas

```sh
npm run typecheck
npm run build
node node_modules/vitest/vitest.mjs run
node tests/personal/browser.mjs
```

La prueba de navegador requiere Playwright disponible en `.local-data/tooling/node_modules/playwright` o `PLAYWRIGHT_MODULE`, Chrome y el harness anterior en marcha. Bloquea solicitudes externas y verifica shell, recorridos, terminal y ausencia de overflow a 375, 390, 430, 768, 1024 y 1440 px. Genera capturas y `evidence.json` en `.local-data/personnel-prototype/` (artefactos locales ignorados).

Sin migraciones, escrituras Supabase, cambios RLS, documentos reales, credenciales de proveedores, commits, pushes ni despliegues.
