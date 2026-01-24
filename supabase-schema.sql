-- ═══════════════════════════════════════════════════════════════════════════
-- MINEIRO v4 - Schema Simplificado (Ejecutar en Supabase SQL Editor)
-- Este script es IDEMPOTENTE - puedes ejecutarlo múltiples veces sin error
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: sites (para el nuevo sistema universal)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url TEXT,
  name TEXT,
  last_scan TIMESTAMPTZ,
  element_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  plan TEXT DEFAULT 'trial',
  estado_pago BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_site_id ON sites(site_id);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: elements (elementos editables detectados)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  xpath TEXT,
  selector TEXT,
  context TEXT DEFAULT 'main',
  original_value TEXT,
  current_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  visible BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, element_id)
);

CREATE INDEX IF NOT EXISTS idx_elements_site_id ON elements(site_id);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);

-- ─────────────────────────────────────────────────────────────────────────
-- AGREGAR site_config A TIENDAS (si existe la tabla)
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tiendas') THEN
    ALTER TABLE tiendas ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: testimonios
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tiendas') THEN
    CREATE TABLE IF NOT EXISTS testimonios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tienda_id UUID REFERENCES tiendas(id) ON DELETE CASCADE,
      user_id UUID,
      dom_id TEXT,
      nombre TEXT,
      texto TEXT,
      imagen TEXT,
      rating INTEGER DEFAULT 5,
      producto_comprado TEXT,
      visible BOOLEAN DEFAULT true,
      orden INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_testimonios_tienda ON testimonios(tienda_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS - Habilitar y crear políticas (con DROP IF EXISTS)
-- ─────────────────────────────────────────────────────────────────────────

-- Sites
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sites públicos son legibles" ON sites;
CREATE POLICY "Sites públicos son legibles" ON sites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Usuario puede gestionar sus sites" ON sites;
CREATE POLICY "Usuario puede gestionar sus sites" ON sites FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Cualquiera puede crear sites" ON sites;
CREATE POLICY "Cualquiera puede crear sites" ON sites FOR INSERT WITH CHECK (true);

-- Elements
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Elementos son públicos para lectura" ON elements;
CREATE POLICY "Elementos son públicos para lectura" ON elements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Elementos editables por dueño del site" ON elements;
CREATE POLICY "Elementos editables por dueño del site" ON elements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.site_id = elements.site_id AND sites.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Elementos insertables" ON elements;
CREATE POLICY "Elementos insertables" ON elements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Elementos eliminables por dueño" ON elements;
CREATE POLICY "Elementos eliminables por dueño" ON elements FOR DELETE USING (
  EXISTS (SELECT 1 FROM sites WHERE sites.site_id = elements.site_id AND sites.user_id = auth.uid())
);

-- Testimonios (solo si existe)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'testimonios') THEN
    ALTER TABLE testimonios ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Testimonios visibles son públicos" ON testimonios;
    CREATE POLICY "Testimonios visibles son públicos" ON testimonios FOR SELECT USING (visible = true);
    
    DROP POLICY IF EXISTS "Usuario puede gestionar sus testimonios" ON testimonios;
    CREATE POLICY "Usuario puede gestionar sus testimonios" ON testimonios FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGER: updated_at automático
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sites_updated_at ON sites;
CREATE TRIGGER sites_updated_at BEFORE UPDATE ON sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS elements_updated_at ON elements;
CREATE TRIGGER elements_updated_at BEFORE UPDATE ON elements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS PARA TIENDAS - Permitir lectura pública
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tiendas') THEN
    ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Tiendas son legibles públicamente" ON tiendas;
    CREATE POLICY "Tiendas son legibles públicamente" ON tiendas FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Tiendas editables por service role" ON tiendas;
    CREATE POLICY "Tiendas editables por service role" ON tiendas FOR UPDATE USING (true);
    
    DROP POLICY IF EXISTS "Tiendas insertables" ON tiendas;
    CREATE POLICY "Tiendas insertables" ON tiendas FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS PARA PRODUCTOS - Permitir lectura pública
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
    ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Productos visibles son públicos" ON productos;
    CREATE POLICY "Productos visibles son públicos" ON productos FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Productos editables" ON productos;
    CREATE POLICY "Productos editables" ON productos FOR UPDATE USING (true);
    
    DROP POLICY IF EXISTS "Productos insertables" ON productos;
    CREATE POLICY "Productos insertables" ON productos FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS TESTIMONIOS - Actualizar para lectura pública
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'testimonios') THEN
    DROP POLICY IF EXISTS "Testimonios visibles son públicos" ON testimonios;
    CREATE POLICY "Testimonios visibles son públicos" ON testimonios FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Testimonios editables" ON testimonios;
    CREATE POLICY "Testimonios editables" ON testimonios FOR UPDATE USING (true);
    
    DROP POLICY IF EXISTS "Testimonios insertables" ON testimonios;
    CREATE POLICY "Testimonios insertables" ON testimonios FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- REALTIME - Habilitar para todas las tablas necesarias
-- ─────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sites;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE elements;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tiendas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tiendas;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE productos;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'testimonios') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE testimonios;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ LISTO! Ejecuta este script en el SQL Editor de Supabase
-- Luego:
-- 1. Pega el script en la web del cliente
-- 2. Abre el editor en /editor/{slug}
-- ═══════════════════════════════════════════════════════════════════════════
