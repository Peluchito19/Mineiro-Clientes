# Mineiro v6 - Editor Visual de Páginas Web

Sistema de edición en línea para páginas web de clientes. Permite a los clientes editar textos, imágenes y precios directamente sobre el diseño existente.

## 🚀 Inicio Rápido

### 1. Configurar Supabase

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor**
3. Copia y ejecuta el contenido de `supabase-schema.sql`

### 2. Configurar Variables de Entorno

Crea un archivo `.env.local` con:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role
```

### 3. Ejecutar Localmente

```bash
npm install
npm run dev
```

## 📝 Uso del Script en Páginas de Clientes

Agrega este script antes de `</body>` en la página del cliente:

```html
<script 
  src="https://mineiro-clientes.vercel.app/mineiro.js" 
  data-mineiro-site="slug-de-la-tienda"
></script>
```

### Acceder al Modo Admin

Agrega `?mineiro-admin` a cualquier URL:
```
https://cosmeticos-fran.vercel.app/?mineiro-admin
```

## 🔗 Bindings Disponibles

### Configuración de Tienda
```html
<span data-mineiro-bind="config-tienda.nombre_tienda">Mi Tienda</span>
```

### Hero/Banner
```html
<h1 data-mineiro-bind="hero.titulo">Título del Hero</h1>
<p data-mineiro-bind="hero.subtitulo">Subtítulo</p>
<img data-mineiro-bind="hero.imagen_fondo" src="..." />
```

### Footer
```html
<p data-mineiro-bind="footer.descripcion">Descripción</p>
<span data-mineiro-bind="footer.nombre_tienda">Nombre</span>
```

### Productos
```html
<h3 data-mineiro-bind="producto-mascara.nombre">Máscara</h3>
<span data-mineiro-bind="producto-mascara.precio">$15.000</span>
<img data-mineiro-bind="producto-mascara.imagen_url" src="..." />
```

### Testimonios
```html
<p data-mineiro-bind="testimonio-1.texto">Excelente producto</p>
<span data-mineiro-bind="testimonio-1.nombre">María</span>
```

## 🔄 Sincronización en Tiempo Real

El script usa:
1. **WebSocket/Realtime de Supabase** (cuando está disponible)
2. **Polling cada 5 segundos** (como fallback)

Los cambios hechos en el panel admin se reflejan automáticamente en la página original.

## 🛠️ API Endpoints

- `GET /api/tienda?slug=xxx` - Obtener datos de tienda
- `POST /api/edit` - Guardar cambios

## 📦 Despliegue en Vercel

1. Push a GitHub
2. Conecta el repo en Vercel
3. Agrega las variables de entorno
4. Deploy

## 🐛 Solución de Problemas

### Error 401 en productos/testimonios
- Ejecuta el SQL schema actualizado en Supabase
- Verifica que las políticas RLS permitan lectura pública

### WebSocket falla
- Es normal, el sistema usa polling como respaldo
- Los cambios se sincronizan cada 5 segundos

### Producto no encontrado
- El sistema guarda en `site_config` si no hay productos en BD
- Verifica que el `dom_id` del binding coincida

## 📋 Comandos Útiles en Consola

```javascript
// Refrescar datos manualmente
MineiroAdmin.refresh()

// Forzar sincronización
MineiroAdmin.forceSync()

// Ver datos cargados
MineiroAdmin.getData()

// Ver versión
MineiroAdmin.version
```
