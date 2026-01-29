-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT DE LIMPIEZA DE PRECIOS CORRUPTOS
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1: VER QUÉ HAY EN SITE_CONFIG (DIAGNÓSTICO)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ver todas las tiendas y su site_config
SELECT 
    id,
    nombre_negocio,
    slug,
    site_config
FROM tiendas;

-- Ver específicamente site_config.productos (donde se guardan precios editados)
SELECT 
    id,
    nombre_negocio,
    site_config->'productos' as productos_guardados,
    site_config->'config'->'menu' as menu_guardado
FROM tiendas
WHERE site_config IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2: LIMPIAR SITE_CONFIG.PRODUCTOS Y CONFIG.MENU DE TODAS LAS TIENDAS
-- ═══════════════════════════════════════════════════════════════════════════

-- OPCIÓN A: Limpiar SOLO site_config.productos (precios editados)
UPDATE tiendas
SET site_config = site_config - 'productos'
WHERE site_config ? 'productos';

-- OPCIÓN B: Limpiar TAMBIÉN config.menu
UPDATE tiendas
SET site_config = jsonb_set(
    COALESCE(site_config, '{}'::jsonb) - 'productos',
    '{config}',
    (COALESCE(site_config->'config', '{}'::jsonb) - 'menu')
)
WHERE site_config IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3: LIMPIAR COMPLETAMENTE SITE_CONFIG (NUCLEAR - USA CON CUIDADO)
-- ═══════════════════════════════════════════════════════════════════════════

-- ADVERTENCIA: Esto borra TODO el site_config, no solo productos
-- Solo usar si las opciones anteriores no funcionan

-- UPDATE tiendas SET site_config = '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4: VER LA TABLA PRODUCTOS (donde puede estar el $10.000)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ver todos los productos con sus precios
SELECT 
    id,
    nombre,
    dom_id,
    precio,
    configuracion,
    tienda_id
FROM productos
ORDER BY nombre;

-- Buscar productos con precio 10000
SELECT 
    id,
    nombre,
    dom_id,
    precio,
    configuracion->'precios' as precios_por_tamano
FROM productos
WHERE precio = 10000 OR configuracion::text LIKE '%10000%';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 5: ACTUALIZAR PRECIOS EN TABLA PRODUCTOS (si el problema está ahí)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ejemplo: Actualizar el precio de un producto específico
-- UPDATE productos 
-- SET precio = 9690,
--     configuracion = jsonb_set(
--         COALESCE(configuracion, '{}'::jsonb),
--         '{precios,fam}',
--         '9690'::jsonb
--     )
-- WHERE nombre ILIKE '%napolitana%';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 6: LIMPIAR TABLA ELEMENTS (historial de cambios)
-- ═══════════════════════════════════════════════════════════════════════════

-- Ver elementos guardados relacionados con precios
SELECT * FROM elements 
WHERE type = 'text' 
AND (name LIKE '%precio%' OR current_value LIKE '%10.000%' OR current_value LIKE '%10000%');

-- Eliminar elementos de precio corruptos
DELETE FROM elements 
WHERE (name LIKE '%precio%' OR current_value LIKE '%10.000%' OR current_value LIKE '%10000%');

-- ═══════════════════════════════════════════════════════════════════════════
-- SCRIPT TODO-EN-UNO: LIMPIEZA COMPLETA
-- ═══════════════════════════════════════════════════════════════════════════

-- Ejecuta esto para hacer limpieza completa:

DO $$
BEGIN
    -- 1. Limpiar site_config.productos de todas las tiendas
    UPDATE tiendas
    SET site_config = site_config - 'productos'
    WHERE site_config ? 'productos';
    
    RAISE NOTICE 'Limpiado site_config.productos';
    
    -- 2. Limpiar config.menu de todas las tiendas
    UPDATE tiendas
    SET site_config = jsonb_set(
        COALESCE(site_config, '{}'::jsonb),
        '{config}',
        (COALESCE(site_config->'config', '{}'::jsonb) - 'menu')
    )
    WHERE site_config->'config' ? 'menu';
    
    RAISE NOTICE 'Limpiado config.menu';
    
    -- 3. Eliminar elementos de precio de la tabla elements
    DELETE FROM elements 
    WHERE name LIKE '%precio%' 
       OR current_value LIKE '%10.000%' 
       OR current_value LIKE '%10000%';
    
    RAISE NOTICE 'Limpiados elements de precios';
    
    -- 4. Limpiar configuracion.precios de productos con 10000
    UPDATE productos
    SET configuracion = configuracion - 'precios'
    WHERE configuracion ? 'precios' 
      AND configuracion->'precios'::text LIKE '%10000%';
    
    RAISE NOTICE 'Limpiados precios en configuracion de productos';
    
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar que site_config.productos está vacío
SELECT 
    id,
    nombre_negocio,
    site_config->'productos' as productos_guardados
FROM tiendas;

-- Verificar que no hay elementos con 10000
SELECT * FROM elements WHERE current_value LIKE '%10000%';
