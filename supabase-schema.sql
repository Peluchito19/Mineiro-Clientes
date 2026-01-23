-- ═══════════════════════════════════════════════════════════════════════════
-- MINEIRO v4 - Schema para el sistema de edición universal
-- Ejecuta este script en tu Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: sites
-- Almacena información de cada sitio conectado
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT UNIQUE NOT NULL,  -- Identificador único (ej: "cosmeticos-fran" o hostname)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  url TEXT,                       -- URL del sitio
  name TEXT,                      -- Nombre personalizado
  last_scan TIMESTAMPTZ,          -- Última vez que se escaneó
  element_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,  -- Configuraciones adicionales
  plan TEXT DEFAULT 'trial',      -- trial, basic, pro
  estado_pago BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_sites_site_id ON sites(site_id);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: elements
-- Almacena cada elemento editable detectado en los sitios
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  element_id TEXT NOT NULL,       -- ID único del elemento en el DOM
  type TEXT NOT NULL,             -- price, title, image, button, etc.
  name TEXT,                      -- Nombre legible del elemento
  xpath TEXT,                     -- XPath para encontrar el elemento
  selector TEXT,                  -- CSS selector alternativo
  context TEXT DEFAULT 'main',    -- Contexto/sección donde está el elemento
  original_value TEXT,            -- Valor original cuando se detectó
  current_value TEXT,             -- Valor actual (editado)
  metadata JSONB DEFAULT '{}'::jsonb,  -- Datos adicionales (href, alt, etc.)
  visible BOOLEAN DEFAULT true,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(site_id, element_id)
);

-- Índices para búsquedas y filtros
CREATE INDEX IF NOT EXISTS idx_elements_site_id ON elements(site_id);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);
CREATE INDEX IF NOT EXISTS idx_elements_context ON elements(context);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: tiendas (mantener compatibilidad con sistema anterior)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE tiendas 
ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────
-- TABLA: testimonios
-- ─────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────
-- RLS POLICIES - Seguridad a nivel de fila
-- ─────────────────────────────────────────────────────────────────────────

-- Sites
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sites públicos son legibles" ON sites;
DROP POLICY IF EXISTS "Usuario puede gestionar sus sites" ON sites;
DROP POLICY IF EXISTS "Cualquiera puede crear sites" ON sites;

CREATE POLICY "Sites públicos son legibles" ON sites
  FOR SELECT USING (true);

CREATE POLICY "Usuario puede gestionar sus sites" ON sites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Cualquiera puede crear sites" ON sites
  FOR INSERT WITH CHECK (true);

-- Elements
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Elementos son públicos para lectura" ON elements;
DROP POLICY IF EXISTS "Elementos editables por dueño del site" ON elements;
DROP POLICY IF EXISTS "Elementos insertables por dueño o sistema" ON elements;

CREATE POLICY "Elementos son públicos para lectura" ON elements
  FOR SELECT USING (true);

CREATE POLICY "Elementos editables por dueño del site" ON elements
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sites 
      WHERE sites.site_id = elements.site_id 
      AND sites.user_id = auth.uid()
    )
  );

CREATE POLICY "Elementos insertables por dueño o sistema" ON elements
  FOR INSERT WITH CHECK (true);

-- Testimonios
ALTER TABLE testimonios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testimonios visibles son públicos" ON testimonios;
DROP POLICY IF EXISTS "Usuario puede gestionar sus testimonios" ON testimonios;

CREATE POLICY "Testimonios visibles son públicos" ON testimonios
  FOR SELECT USING (visible = true);

CREATE POLICY "Usuario puede gestionar sus testimonios" ON testimonios
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- TRIGGER: Actualizar updated_at automáticamente
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sites_updated_at ON sites;
CREATE TRIGGER sites_updated_at
  BEFORE UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS elements_updated_at ON elements;
CREATE TRIGGER elements_updated_at
  BEFORE UPDATE ON elements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- REALTIME: Habilitar para sincronización en tiempo real
-- ─────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sites;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'elements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE elements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'testimonios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE testimonios;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ Schema listo! 
-- Ahora puedes usar Mineiro para editar cualquier sitio web.
-- ═══════════════════════════════════════════════════════════════════════════
