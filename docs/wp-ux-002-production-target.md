# WP-UX-002: production target and performance

The intended production tenant is El Criollo, with `vegendigital@gmail.com` as platform administrator. The intended enabled production modules are Bancos and Personal; other modules are to remain disabled. The future Gerente user is not created by this work. These are targets for a separate approved production change, not changes made here.

Consolidado requests its paginated movement page and organization catalogs on initial load. Transfer candidates and the assisted-classification sample are requested when their respective workflows are opened. Catalogs are reused within the mounted organization workspace and refreshed after catalog-affecting edits.

Resumen and Métricas still fetch full movement history when opened. Large histories can therefore increase latency and memory use; bounded server-side analytics remain future work.
