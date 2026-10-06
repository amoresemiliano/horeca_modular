# 00 - Resumen Ejecutivo del Estudio de Arquitectura (Fase 2B)

## 1. Objetivo y Alcance del Documento

El presente documento constituye el Resumen Ejecutivo del estudio y evaluación de arquitectura (Fase 2B) para la implementación del **Hub Económico y Módulo de Extractos** de **Taquería El Criollo / Vegen Digital SL**.

Esta intervención se ha desarrollado bajo una naturaleza **exclusivamente documental y analítica**, cumpliendo con la **Regla de Oro de Vegen Digital SL**: *ninguna modificación del sistema o migración debe comprometer la operatividad del servicio HORECA activo*. No se ha ejecutado ninguna alteración de código en producción (`src/` o `app/`), no se han instalado nuevas dependencias en los manifiestos principales, no se ha conectado el sistema con bases de datos ni servicios en vivo y no se han desplegado cambios.

## 2. Estado de la Decisión Arquitectónica

Como resultado de la inspección técnica estática y la comparación rigurosa de las alternativas de infraestructura, se registra la combinación tecnológica:

`SPA React/Vite + Supabase/PostgreSQL`

bajo el estado oficial de:

`ALTERNATIVA PRESELECCIONADA PARA EL MVP`

Esta combinación **no se declara todavía como arquitectura productiva definitiva**. La aprobación final y su eventual paso a despliegue en entornos productivos quedan expresamente condicionados a la resolución satisfactoria de los siguientes factores bloqueantes y fases preparatorias:
* Definición y validación de la **política de autenticación** y su compatibilidad con las sesiones operativas actuales.
* Configuración formal de **políticas de almacenamiento (Storage Rules / RLS)** para ficheros originales.
* Validación empírica del **modelo relacional mínimo corregido**, centrado en la vertical de importación transitoria.
* Aplicación de las medidas de **seguridad y mitigación** frente a archivos de entrada no confiables.
* Establecimiento de una estrategia técnica y procedimental de **copias de seguridad (backups)** independiente de Git.
* Ejecución y superación del plan de pruebas de endurecimiento en la futura **Fase 2C**.
* Definición y aprobación de un **plan de transición gradual y desacoplado** desde el laboratorio de parsers hacia el núcleo del ERP.

## 3. Síntesis de Findings y Estructura Documental

La inspección estática del repositorio evidenció la coexistencia en el manifiesto raíz de clientes para dos proveedores en la nube (`@supabase/supabase-js` y `firebase`), utilizándose en el estado actual Firebase para la autenticación en cliente y Supabase de manera exploratoria con clave anónima para consultas simples. Para corregir las posibles inconsistencias y evitar exposiciones de datos, esta serie documental desarrolla los requerimientos obligatorios, modelos temporales, políticas de seguridad y pasos necesarios antes de proceder al código operativo.

El cuerpo documental del estudio arquitectónico se estructura en los 16 entregables temáticos complementarios detallados en el archivo `manifest.json` adjunto en este directorio.
