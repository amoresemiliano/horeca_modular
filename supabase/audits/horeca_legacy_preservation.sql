-- Read-only content fingerprints; no row contents leave the database.
SELECT 'categorias' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.categorias t
UNION ALL
SELECT 'empleados' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.empleados t
UNION ALL
SELECT 'extractos' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.extractos t
UNION ALL
SELECT 'fichajes' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.fichajes t
UNION ALL
SELECT 'incidencias' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.incidencias t
UNION ALL
SELECT 'produccion_registros' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.produccion_registros t
UNION ALL
SELECT 'proveedores' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.proveedores t
UNION ALL
SELECT 'recetas' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.recetas t
UNION ALL
SELECT 'subcategorias' AS table_name,count(*) AS row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_md5 FROM public.subcategorias t
ORDER BY table_name;
