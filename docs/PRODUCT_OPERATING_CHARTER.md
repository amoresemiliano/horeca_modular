# HORECA Modular — Product Operating Charter

> Documento canónico de objetivos, reglas operativas, decisiones de arquitectura y modo de trabajo del proyecto.
>
> Estado: ACTIVO
>
> Repositorio canónico: `amoresemiliano/horeca_modular`
>
> Rama de integración: `dev`
>
> Este documento debe actualizarse cuando se agreguen reglas, condiciones, prioridades, restricciones u objetivos relevantes. Su función es evitar pérdida de foco, decisiones contradictorias y ciclos improductivos entre agentes.

---

## 1. Principio general de trabajo

El proyecto entra en una etapa de ejecución orientada a resultados. A partir de ahora se priorizan verticales funcionales, datos reales, persistencia, validación end-to-end y aprendizaje operativo por encima de documentación extensa, planes redundantes o fases que no aporten una mejora verificable.

La regla operativa es:

**menos documentación ceremonial + más implementación verificable + validación rápida + integración progresiva.**

Todo desarrollo debe procurar entregar funcionalidad comprobable sin comprometer producción ni introducir cambios destructivos.

---

## 2. Repositorio, ramas y entornos

### Repositorio canónico

`amoresemiliano/horeca_modular`

### Estrategia Git

- `main`: estable / producción.
- `dev`: integración.
- `feature/extractos`: desarrollo paralelo del módulo Extractos.
- `feature/escandallos`: desarrollo paralelo del módulo Escandallos.

Los agentes pueden crear commits y push en ramas `dev` o `feature/*` siempre que:

- no hagan cambios destructivos;
- no borren datos;
- no desplieguen producción sin aprobación;
- mantengan tests y trazabilidad;
- eviten sobrescribir trabajo concurrente.

---

## 3. Arquitectura objetivo

Supabase queda definido como backend unificado del Hub:

- PostgreSQL
- Supabase Auth
- Social Login
- Row Level Security
- Storage
- Edge Functions cuando haya necesidad real de ejecución privilegiada o transaccional server-side

Firebase queda fuera de la arquitectura objetivo.

La migración del código legacy Firebase se hará de forma controlada después de validar Supabase Auth en staging.

### Multi-tenant y multiusuario

El producto final será SaaS multi-tenant y multiusuario.

El MVP actual sirve primero a Taquería El Criollo, pero las nuevas entidades deben evitar acoplamientos que impidan la evolución multiempresa.

Roles iniciales:

- ADMIN
- GERENTE
- OPERADOR
- CONSULTA

Roles futuros previstos:

- cocinero / cocina
- carga documental
- producción
- administración
- contable / asesor fiscal
- otros roles configurables

---

## 4. Objetivo inmediato

Hay dos frentes prioritarios y paralelos:

### Track A — Extractos / Finanzas

Responsable principal sugerido: **Antigravity**.

Objetivo: convertir extractos bancarios reales en datos persistidos, revisables, clasificados y útiles para análisis financiero y PyG.

### Track B — Escandallos

Responsable principal sugerido: **Jules**.

Objetivo: convertir recetas, ingredientes, elaboraciones, unidades, mermas y costes en un módulo operativo conectado posteriormente con Compras y Ventas.

Ambos tracks deben compartir contratos de datos y arquitectura para poder converger sin retrabajo.

---

# TRACK A — EXTRACTOS / FINANZAS

## 5. Fuentes iniciales

El sistema debe importar directamente los archivos descargados del banco, sin preparación manual.

Fuentes actuales:

- BBVA cuenta MC
- BBVA cuenta MT
- BBVA tarjeta
- Sabadell cuenta
- Sabadell tarjeta

Más adelante se incorporará histórico desde enero de 2023.

La carga operativa prevista será aproximadamente una vez por semana.

En una fase futura se evaluará automatización por API bancaria diaria.

---

## 6. Flujo de importación

Flujo base:

`subir archivo → detectar banco/cuenta/tarjeta → preview breve → detectar duplicados → confirmar importación → clasificar → revisar pendientes`

El preview es obligatorio inicialmente para asegurar que el sistema reconoce correctamente cada formato.

La importación debe persistir datos y registrar historial de importaciones.

---

## 7. Vista de movimientos

Todos los movimientos deben aparecer en un listado consolidado.

Debe ser posible filtrar por origen:

- BBVA MC
- BBVA MT
- BBVA tarjeta
- Sabadell cuenta
- Sabadell tarjeta

Cada cuenta/tarjeta conserva su identidad porque representa circuitos económicos diferentes.

---

## 8. Clasificación económica

Modelo base:

`Contraparte → Categoría → Subcategoría`

Estados:

- pendiente
- sugerido
- confirmado
- requiere revisión

La intervención humana es obligatoria en decisiones de clasificación relevantes.

Cuando el sistema detecte similitud:

- propone una asignación;
- explica o evidencia la coincidencia;
- el usuario confirma o corrige.

Cuando no haya suficiente evidencia:

- consulta al usuario;
- no inventa una clasificación.

Las decisiones confirmadas pueden alimentar reglas futuras.

---

## 9. Contraparte

`Contraparte` es el concepto técnico general, más amplio que proveedor.

Puede representar:

- proveedor
- cliente
- plataforma
- banco
- administración pública
- empleado
- cuenta propia
- TPV
- financiación
- otro

---

## 10. Taxonomía y PyG

Las categorías actuales deben revisarse y normalizarse.

La taxonomía económica debe alinearse con la estructura útil de los archivos PyG para evitar duplicaciones.

Objetivo:

`Extractos → clasificación económica → PyG dinámico`

El sistema debe generar la información de gestión dentro de la aplicación; los Excel actuales sirven como referencia estructural y formato de exportación, no como limitación del modelo interno.

Exportaciones futuras:

- XLSX
- CSV
- PDF

---

## 11. Reglas y aprendizaje operativo

Cuando el usuario confirme una clasificación recurrente, el sistema debe recordar la decisión y sugerirla en movimientos futuros similares.

Ejemplo:

`MAKRO → Contraparte Makro → Compras / Materia prima`

Inicialmente se priorizan reglas determinísticas basadas en contraparte, concepto, referencia y patrones.

IA generativa no es requisito para el MVP.

---

## 12. Transferencias internas y tarjetas

### Transferencias entre cuentas propias

Movimientos BBVA ↔ Sabadell deben poder detectarse como transferencias internas.

No deben computarse como ingreso o gasto en PyG.

### Tarjetas

El gasto económico se reconoce en los movimientos individuales de tarjeta.

El cargo posterior de liquidación de tarjeta en cuenta bancaria debe tratarse como liquidación/transferencia y no duplicar el gasto.

Esto es obligatorio para evitar doble contabilización.

---

## 13. Relación con Compras

Los movimientos bancarios deben poder reconciliarse con compras ya existentes.

Ejemplo:

`Compra Makro 423,82 € ↔ débito bancario 423,82 €`

El sistema puede sugerir coincidencias, pero la confirmación inicial es humana.

La conciliación no debe bloquear el primer lanzamiento del módulo si requiere una iteración posterior.

---

## 14. Last / Uber / Glovo

Orden de prioridad:

1. banco
2. clasificación
3. PyG
4. conciliación con Compras
5. Last / Uber / Glovo

Los conectores de ventas y delivery deben quedar previstos arquitectónicamente, pero no bloquear el MVP de Extractos.

---

## 15. Operaciones manuales

Un usuario debe poder:

- editar contraparte
- editar categoría
- editar subcategoría
- editar notas
- eliminar cuando corresponda y exista política segura
- duplicar / clonar cuando tenga sentido operativo
- dividir un movimiento entre varias categorías

El split es parte del modelo esperado.

---

## 16. Dashboard inicial de Finanzas

Prioridades iniciales:

- movimientos / saldos por cuenta y consolidado
- ingresos vs gastos mensuales
- gasto por categoría
- evolución mensual
- PyG
- pendientes de clasificar

---

# TRACK B — ESCANDALLOS

## 17. Fuente de estructura y fuente de precios

El archivo de Escandallos sirve para importar:

- recetas
- elaboraciones
- ingredientes
- cantidades
- unidades
- proporciones
- mermas
- relaciones entre recetas

El módulo Compras será la fuente operativa de precios de ingredientes.

Los precios del Excel son referencia inicial, no fuente futura canónica.

---

## 18. Política de precio por ingrediente

Valor por defecto inicial:

**última compra**.

Cada producto debe permitir configurar la estrategia de coste entre:

- última compra
- coste promedio ponderado
- promedio últimos X días
- precio manual
- otra estrategia futura configurable

El sistema debe guardar la política seleccionada por producto.

---

## 19. Recetas y elaboraciones anidadas

El sistema debe soportar recetas dentro de recetas.

Ejemplo:

`Taco Pastor → Tortilla + Guiso Pastor`

`Guiso Pastor → carne + cebolla + especias + ...`

Las elaboraciones intermedias son entidades de primera clase.

---

## 20. Merma

La merma impacta el coste real.

Ejemplo:

`10 kg comprados → 8 kg útiles`

El coste unitario útil debe reflejar esta pérdida.

---

## 21. Unidades y conversiones

Debe existir soporte para conversiones como:

- kg ↔ g
- l ↔ ml
- caja ↔ unidad
- botella ↔ ml
- paquete ↔ unidades

Cuando la equivalencia no sea universal, se define por producto.

Las equivalencias deben permitir ajustes manuales.

---

## 22. Elaboraciones y producción

El sistema debe manejar por elaboración:

- cantidad producida
- unidad final
- merma
- coste total
- coste por unidad / kg / litro
- raciones potenciales cuando corresponda

Existe un módulo de Producción funcional que se integrará después de cerrar Extractos y Escandallos y revisar Compras, KPIs y Predicciones.

---

## 23. Precio de venta

La fuente futura preferida del PVP es Last.app.

Debe existir también carga manual de precio de venta.

---

## 24. Métricas por plato / elaboración

Cada escandallo debe mostrar como mínimo:

- coste ingredientes
- coste de elaboración
- food cost %
- precio de venta
- margen bruto €
- margen bruto %

Para análisis de margen se prioriza precio de venta sin IVA.

El margen debe recalcularse automáticamente cuando cambie cualquier coste aguas abajo.

---

## 25. Costes adicionales

El MVP incluye:

- ingredientes
- packaging

Mano de obra y otros costes podrán añadirse en etapas posteriores.

---

## 26. Actualización automática de costes

Cambio de precio en Compras:

`ingrediente → elaboración → plato → food cost → margen`

Todo debe recalcularse automáticamente sin editar manualmente la receta.

A futuro se podrán definir reglas para ajustar automáticamente precios de venta ante variaciones de costes.

---

## 27. Histórico

El histórico de coste es crítico.

Debe ser posible reconstruir cómo varió el coste de un plato o elaboración en el tiempo.

Ejemplo:

`Taco Pastor: 0,41 € → 0,48 €`

Se conservarán snapshots/versiones o equivalente que permita análisis histórico.

---

## 28. Edición de recetas

La app debe permitir:

- crear
- editar
- añadir ingrediente
- eliminar ingrediente
- cambiar cantidades
- modificar merma
- añadir elaboración
- duplicar/clonar receta
- desactivar receta

Debe conservarse historial/versionado.

---

## 29. Vinculación con Last.app

Cada producto vendido en Last debe poder vincularse con un escandallo.

Ejemplo:

`Last: TACO PASTOR → Escandallo: Taco Pastor`

Esto habilita:

`unidades vendidas × coste teórico = coste teórico de ventas`

Es una función central del producto.

---

## 30. Consumo teórico vs real

Objetivo estratégico central:

`ventas reales → consumo teórico de ingredientes`

comparado con:

`compras + inventario → consumo real`

para detectar:

- mermas
- desviaciones
- pérdidas
- errores
- diferencias operativas

No es obligatorio para el primer sprint, pero condiciona la arquitectura.

---

## 31. Vista principal Escandallos

Vista sugerida:

`Producto | PVP | Coste | Food Cost % | Margen € | Margen % | Estado`

Debe incluir alertas configurables de food cost.

El umbral objetivo es configurable, no fijo.

---

# CORE DEL PRODUCTO

## 32. Cadena económica principal

La arquitectura debe converger hacia:

`COMPRAS`
→ precios reales de ingredientes
→ `ESCANDALLOS`
→ coste teórico de platos
→ `VENTAS`
→ unidades vendidas
→ `COSTE TEÓRICO DE VENTAS`
→ `EXTRACTOS`
→ dinero cobrado/pagado
→ `PyG`
→ análisis de margen, consumo y rentabilidad

Esta cadena es el core del producto HORECA.

---

## 33. Relación con Excel / CSV / PDF

El sistema no debe reproducir la rigidez del Excel como modelo interno.

Los archivos actuales sirven para:

- estructurar conceptos
- migrar información
- validar resultados
- generar formatos familiares para gerencia

Las métricas y relaciones internas pueden ser más ricas.

Exportaciones futuras:

- Excel
- CSV
- PDF

---

# UX / OPERACIÓN

## 34. Usuarios iniciales

Primera etapa:

- uso principal por el administrador del proyecto

Después:

- personal de El Criollo
- diferentes roles operativos
- empresas clientes del SaaS

---

## 35. Desktop y mobile

La gestión compleja puede priorizar desktop.

La carga diaria y tareas rápidas deben ser:

- mobile friendly
- responsive
- simples
- con datos mínimos necesarios
- rápidas de ejecutar

---

## 36. Lenguaje visual

Se conserva el lenguaje visual general del HORECA Hub.

Se autorizan mejoras de:

- navegación
- jerarquía visual
- formularios
- mobile UX
- componentes
- feedback
- accesibilidad

cuando aumenten claridad o velocidad de uso.

---

# MODO DE TRABAJO CON AGENTES

## 37. Distribución de trabajo

ChatGPT coordina y distribuye tareas según eficiencia.

### Antigravity

Principalmente:

- Track Extractos
- Supabase
- importadores
- persistencia
- clasificación
- PyG
- conciliaciones iniciales
- UI del módulo

### Jules

Principalmente:

- Track Escandallos
- modelo de recetas
- elaboraciones
- unidades
- mermas
- costeo
- históricos
- UI del módulo

La distribución puede cambiar si la naturaleza de una tarea lo justifica.

---

## 38. Autonomía autorizada

Los agentes están autorizados a:

- escribir código
- crear migraciones
- ejecutar tests
- usar MCP de Supabase
- aplicar migraciones en `horeca_modular_staging`
- refactorizar código relacionado
- crear commits y push en ramas autorizadas

sin pedir permiso por cada archivo, siempre que:

- no toquen producción;
- no borren datos reales;
- no ejecuten cambios destructivos;
- no hagan deploy productivo sin aprobación;
- respeten aislamiento de ramas;
- documenten decisiones relevantes;
- validen con tests.

---

## 39. Regla contra ciclos improductivos

Evitar:

- planes para preparar otros planes;
- documentación redundante;
- repetir auditorías ya realizadas sin motivo;
- bloquear implementación por decisiones no críticas;
- pedir autorización para cambios triviales dentro del alcance aprobado;
- confundir prototipo, staging y producción.

Cada prompt de ejecución debe indicar:

- agente destinatario;
- objetivo concreto;
- alcance;
- qué significa DONE;
- restricciones reales;
- tests requeridos;
- rama de trabajo;
- salida esperada.

---

## 40. Definición general de DONE

Una funcionalidad no se considera terminada porque exista código o documentación.

Debe, cuando corresponda:

1. aceptar datos reales o fixtures representativos;
2. persistir correctamente;
3. recuperar y mostrar datos;
4. permitir las operaciones previstas;
5. manejar errores relevantes;
6. pasar tests;
7. no romper módulos existentes;
8. ser verificable manualmente;
9. respetar permisos y aislamiento;
10. dejar clara cualquier limitación pendiente.

---

## 41. Orden de integración posterior

Una vez funcionales Extractos y Escandallos:

1. refinar Compras;
2. conectar precios Compras → Escandallos;
3. revisar KPIs;
4. revisar Predicciones;
5. integrar Producción;
6. conectar Last / ventas;
7. avanzar en conciliación completa y consumo teórico vs real;
8. preparar roles ampliados y flujo contable/fiscal.

---

## 42. Principio de mantenimiento de este documento

Este archivo es una referencia viva.

Debe actualizarse cuando:

- se tome una decisión arquitectónica importante;
- cambie una prioridad;
- se incorpore un nuevo módulo;
- se defina una nueva regla transversal;
- se cambie el modo de trabajo;
- aparezca un requisito que afecte varias áreas;
- una decisión anterior quede obsoleta.

Las decisiones nuevas deben añadirse de forma explícita y, cuando sustituyan otras, indicar qué decisión queda deprecada.

---

## 43. Norte del producto

HORECA Modular debe evolucionar desde una herramienta interna de El Criollo hacia un SaaS multi-tenant que conecte operación y economía real del restaurante.

Su diferencial no es únicamente registrar información, sino conectar:

- compras;
- costes;
- recetas;
- producción;
- ventas;
- bancos;
- inventario;
- márgenes;
- KPIs;
- predicciones;
- gestión financiera;

para convertir datos operativos dispersos en decisiones accionables.

Este principio debe utilizarse para priorizar funcionalidades futuras.