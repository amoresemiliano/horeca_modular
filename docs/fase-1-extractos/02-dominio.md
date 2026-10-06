# 02 - Arquitectura de Dominio y Capa Económica Común

## 1. Principio de Diseño: Superación del Importador Bancario

Una limitación recurrente en la programación de herramientas para la hostelería y restauración (HORECA) consiste en reducir la gestión financiera al desarrollo de un mero importador de extractos del banco. Este enfoque aislado fracasa en negocios con alta rotación en sala como **Taquería El Criollo**, donde una parte sustancial de las operaciones operan fuera de las redes bancarias (gastos urgentes pagados con efectivo de caja, anticipos a proveedores en mano o retenciones temporales de pasarelas de cobro e intermediarios logísticos de delivery).

Para solucionar esta dispersión, la presente especificación diseña una **Capa Económica Común**: un marco relacional y de dominio unificado que trata en igualdad de condiciones arquitectónicas los movimientos bancarizados, las liquidaciones de TPV, las ventas diarias, los compromisos de compra de almacén y las operaciones manuales en efectivo.

---

## 2. Diagrama de Dominio y Agregados del Hub Económico

```mermaid
graph TD
    subgraph "AGREGADO DE INGESTA Y FUENTES"
        SRC["Fuente de Datos (Banco / TPV / Caja)"]
        FILE["Archivo Importado (CSV / XLS / XLSX / Manual)"]
        LOTE["Lote de Importación (Trazabilidad y Nivel A)"]
        SRC --> FILE --> LOTE
    end

    subgraph "NÚCLEO TRANSACCIONAL: CAPA ECONÓMICA COMÚN"
        CTA["Cuenta Financiera (Cta. Bancaria / Tarjeta / Caja / Pasarela)"]
        MOV["Movimiento Económico (Entidad Raíz y Agregado Central)"]
        MB["Movimiento Bancario (Ref. Banco / Fecha Valor)"]
        MM["Movimiento Manual (Motivo / Usuario / Adjunto)"]
        MTPV["Cierre / Liquidación TPV (Ventas Agrupadas / Comisiones)"]
        
        CTA --> MOV
        MOV --> MB
        MOV --> MM
        MOV --> MTPV
    end

    subgraph "AGREGADO DE CONTRAPARTE Y CATÁLOGO OPERATIVO"
        CP["Contraparte (Concepto Universal del Interviniente)"]
        ALIAS["Alias de Contraparte (Normalización Nomenclatural)"]
        CAT["Categoría y Subcategoría Económica (Taxonomía)"]
        REG["Regla de Clasificación Determinista"]
        
        CP --> ALIAS
        REG --> CP
        REG --> CAT
    </del>

    subgraph "AGREGADO DE CONCILIACIÓN (NIVEL 2)"
        CONC["Conciliación Operativa (Coincidencias 1:1, 1:N, N:M)"]
        VTA["Venta / Ticket (Last.app)"]
        CMP["Pedido / Compra (EC_pedidos / Almacén)"]
        DOC["Documento / Comprobante (Factura / Ticket PDF)"]
        
        CONC --> MOV
        CONC --> VTA
        CONC --> CMP
        CONC --> DOC
    end

    LOTE --> MOV
    MOV --> CP
    MOV --> CAT
```

---

## 3. Modeling General: El Concepto de `Contraparte`

En los sistemas tradicionales del restaurante coexisten tablas separadas e incompatibles para denominar a terceros ("proveedores" en `EC_pedidos`, "clientes" o "plataformas" en el TPV, "beneficiarios" en el extracto contable). 

La nueva Capa Económica Común instituye técnicamente la entidad fundamental `contraparte` como el sujeto universal de derechos, cobros y obligaciones que interactúa financieramente con Taquería El Criollo.

### 3.1. Tipos Oficiales de Contraparte en la Plataforma (`REQUISITO TÉCNICO`)
* `PROVEEDOR`: Mayoristas gastronómicos y logísticos de cocina y bebidas (ej. distribuidores de carne, hielo, licores, gas). En las pantallas web destinadas a cocineros o compras operativas de sala, el sistema mostrará visualmente el rótulo **"Proveedor"** para facilitar el entendimiento cotidiano en la tienda.
* `CLIENTE`: Comensal o empresa que realiza un consumo formal en sala con solicitud de factura identificada.
* `PLATAFORMA`: Agregador o intermediario logístico del sector HORECA y delivery (ej. Glovo, Uber Eats, Just Eat) o plataformas procesadoras del cobro web en pasarela (Stripe, Paypal).
* `BANCO`: Entidad financiera de crédito emisora del extracto o recaudadora de comisiones y mantenimiento bancario (BBVA, Banco Sabadell).
* `ADMINISTRACIÓN`: Ente gubernamental, recaudador de tributos, fiscalidad o seguridad social (Agencia Tributaria, Seguridad Social, Ayuntamientos).
* `EMPLEADO`: Miembro del equipo de sala, barra, cocina o gerencia perceptor de nóminas, anticipos o abonos extraordinarios por caja.
* `CUENTA_PROPIA`: Otra cuenta bancaria, tarjeta de crédito, cuenta contable de reservas o caja en efectivo perimetral y perteneciente al mismo restaurante titular (utilizada para conciliar traspasos internos sin alterar el balance).
* `TPV`: Terminal o compañía proveedora de la infraestructura de cobro físico en mostrador y mesas (Last.app / Datapoints).
* `FINANCIACIÓN`: Prestamistas, líneas de crédito comercial, leasing o confirming bancario operando en favor del local.
* `OTRO`: Entidades transitorias o sujetos con operaciones excepcionales sin catalogar.

### 3.2. Evaluación de Compatibilidad con Proveedores en Producción (`HECHO VERIFICADO` / `RECOMENDACIÓN`)
* **Radiografía de los Proveedores Actuales:** En la infraestructura en activo (`EC_pedidos`), la entidad de proveedores opera en el servidor de cPanel/Bluehost sobre una tabla MySQL simplificada, identificados mediante un ID autoincremental y un literal con el nombre comercial ("Carnes Valderrama", "Hielo Madrid").
* **Mecanismo de Compatibilidad sin Roturas:** Para evitar la interrupción del servicio en la cocina, el Hub Económico en SPA implementará una tabla relacional paralela de `alias_contrapartes`. Cuando se importe el extracto del Banco Sabadell reflejando el cobro *"RECIBO DOMICILIADO CARNICERIA VALDE SL"*, el motor evaluará el diccionario de alias e identificará de inmediato a la contraparte `PROVEEDOR` reconciliando con el ID del proveedor activo en `EC_pedidos`, unificando las finanzas administrativas con el sistema heredado en producción en vivo.

---

## 4. Estructuración del Agregado Raíz: `Movimiento Económico`

Todo asiento de entrada o salida patrimonial se normalizará obligatoriamente hacia el modelo raíz `movimiento_economico`. La especificidad particular del canal transaccional no requiere fragmentar el sistema en tres bases separadas y desconectadas; se resuelve mediante una relación modular de herencia lógica con extensiones polimórficas (o tablas secundarias subordinadas) para preservar los metadatos de origen:

1. **Movimientos Bancarizados (`movimiento_bancario`):** Vinculados a descargas consolidadas o archivos Excel procedentes de BBVA y Banco Sabadell. Almacenan invariablemente el código de referencia bancaria oficial, fecha de operación contable, fecha valor comercial y número de cuenta del extracto.
2. **Movimientos Manuales y Efectivo (`movimiento_manual`):** Operaciones registradas directamente por el gerente en la interfaz del sistema para asentar abonos en metálico, retiros de caja o ajustes de saldo. Sujetos incondicionalmente a controles de auditoría: registro de usuario creador, marca de tiempo inalterable, motivo documentado y preservación obligatoria de ficheros justificantes adjuntos.
3. **Liquidaciones Agrupadas de TPV (`cierre_tpv`):** Asiento que consolida un conjunto de ventas despachadas en mesa por el TPV de sala que ingresan en bloque a las cuentas del banco horas o días después, segregando matemáticamente en sus líneas el margen del local y las comisiones bancarias descontadas en tarjeta o por la plataforma de delivery.
