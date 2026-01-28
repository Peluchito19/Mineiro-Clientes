# Guía de Implementación de Categorías - Mineiro Engine

## Descripción General

El sistema ahora soporta bindings jerárquicos para categorías del menú usando el formato:
```
data-mineiro-bind="menu.categorias.{categoria-slug}.{campo}"
```

Donde:
- **{categoria-slug}**: Es la versión en minúsculas y con guiones de la categoría
- **{campo}**: Puede ser `boton`, `icono`, o `titulo`

## Categorías Disponibles para Pizzeria Kairos

### 1. Tradicionales
```html
<!-- Botón (filtra automáticamente los productos) -->
<button data-mineiro-bind="menu.categorias.tradicionales.boton">
  Tradicionales
</button>

<!-- Ícono -->
<i data-mineiro-bind="menu.categorias.tradicionales.icono" class="icon-pizza"></i>

<!-- Título -->
<h2 data-mineiro-bind="menu.categorias.tradicionales.titulo">
  Pizzas Tradicionales
</h2>

<!-- Contenedor de productos -->
<div data-mineiro-section="Tradicionales"></div>
```

### 2. De Casa
```html
<button data-mineiro-bind="menu.categorias.de-casa.boton">De Casa</button>
<i data-mineiro-bind="menu.categorias.de-casa.icono"></i>
<h2 data-mineiro-bind="menu.categorias.de-casa.titulo">De Casa</h2>
<div data-mineiro-section="De Casa"></div>
```

### 3. Con Carnes
```html
<button data-mineiro-bind="menu.categorias.con-carnes.boton">Con Carnes</button>
<i data-mineiro-bind="menu.categorias.con-carnes.icono"></i>
<h2 data-mineiro-bind="menu.categorias.con-carnes.titulo">Con Carnes</h2>
<div data-mineiro-section="Con Carnes"></div>
```

### 4. Marinas
```html
<button data-mineiro-bind="menu.categorias.marinas.boton">Marinas</button>
<i data-mineiro-bind="menu.categorias.marinas.icono"></i>
<h2 data-mineiro-bind="menu.categorias.marinas.titulo">Marinas</h2>
<div data-mineiro-section="Marinas"></div>
```

### 5. Vegetarianas
```html
<button data-mineiro-bind="menu.categorias.vegetarianas.boton">Vegetarianas</button>
<i data-mineiro-bind="menu.categorias.vegetarianas.icono"></i>
<h2 data-mineiro-bind="menu.categorias.vegetarianas.titulo">Vegetarianas</h2>
<div data-mineiro-section="Vegetarianas"></div>
```

### 6. Todas las Pizzas
```html
<button data-mineiro-bind="menu.categorias.todas-las-pizzas.boton">Todas</button>
<i data-mineiro-bind="menu.categorias.todas-las-pizzas.icono"></i>
<h2 data-mineiro-bind="menu.categorias.todas-las-pizzas.titulo">Todas las Pizzas</h2>
<div data-mineiro-section="Todas Las Pizzas"></div>
```

### 7. Pan de Ajo
```html
<button data-mineiro-bind="menu.categorias.pan-de-ajo.boton">Pan de Ajo</button>
<i data-mineiro-bind="menu.categorias.pan-de-ajo.icono"></i>
<h2 data-mineiro-bind="menu.categorias.pan-de-ajo.titulo">Pan de Ajo</h2>
<div data-mineiro-section="Pan De Ajo"></div>
```

### 8. Rolls
```html
<button data-mineiro-bind="menu.categorias.rolls.boton">Rolls</button>
<i data-mineiro-bind="menu.categorias.rolls.icono"></i>
<h2 data-mineiro-bind="menu.categorias.rolls.titulo">Rolls</h2>
<div data-mineiro-section="Rolls"></div>
```

### 9. Hamburguesas
```html
<button data-mineiro-bind="menu.categorias.hamburguesas.boton">Hamburguesas</button>
<i data-mineiro-bind="menu.categorias.hamburguesas.icono"></i>
<h2 data-mineiro-bind="menu.categorias.hamburguesas.titulo">Hamburguesas</h2>
<div data-mineiro-section="Hamburguesas"></div>
```

### 10. Papas Cargadas
```html
<button data-mineiro-bind="menu.categorias.papas-cargadas.boton">Papas Cargadas</button>
<i data-mineiro-bind="menu.categorias.papas-cargadas.icono"></i>
<h2 data-mineiro-bind="menu.categorias.papas-cargadas.titulo">Papas Cargadas</h2>
<div data-mineiro-section="Papas Cargadas"></div>
```

### 11. Papas Simples
```html
<button data-mineiro-bind="menu.categorias.papas-simples.boton">Papas Simples</button>
<i data-mineiro-bind="menu.categorias.papas-simples.icono"></i>
<h2 data-mineiro-bind="menu.categorias.papas-simples.titulo">Papas Simples</h2>
<div data-mineiro-section="Papas Simples"></div>
```

### 12. Aros de Cebolla
```html
<button data-mineiro-bind="menu.categorias.aros-de-cebolla.boton">Aros de Cebolla</button>
<i data-mineiro-bind="menu.categorias.aros-de-cebolla.icono"></i>
<h2 data-mineiro-bind="menu.categorias.aros-de-cebolla.titulo">Aros de Cebolla</h2>
<div data-mineiro-section="Aros De Cebolla"></div>
```

## Ejemplo Completo de Menú con Tabs

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Pizzería Kairos - Menú</title>
  <style>
    .category-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .category-tabs button {
      padding: 10px 20px;
      border: 2px solid #f59e0b;
      background: transparent;
      color: #f59e0b;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
    }
    .category-tabs button:hover,
    .category-tabs button.active {
      background: #f59e0b;
      color: white;
    }
    .products-container {
      min-height: 400px;
    }
  </style>
</head>
<body>
  <div class="menu-container">
    <h1>Nuestro Menú</h1>
    
    <!-- Tabs de Categorías -->
    <div class="category-tabs">
      <button data-mineiro-bind="menu.categorias.tradicionales.boton">Tradicionales</button>
      <button data-mineiro-bind="menu.categorias.de-casa.boton">De Casa</button>
      <button data-mineiro-bind="menu.categorias.con-carnes.boton">Con Carnes</button>
      <button data-mineiro-bind="menu.categorias.marinas.boton">Marinas</button>
      <button data-mineiro-bind="menu.categorias.vegetarianas.boton">Vegetarianas</button>
      <button data-mineiro-bind="menu.categorias.pan-de-ajo.boton">Pan de Ajo</button>
      <button data-mineiro-bind="menu.categorias.rolls.boton">Rolls</button>
      <button data-mineiro-bind="menu.categorias.hamburguesas.boton">Hamburguesas</button>
      <button data-mineiro-bind="menu.categorias.papas-cargadas.boton">Papas Cargadas</button>
      <button data-mineiro-bind="menu.categorias.papas-simples.boton">Papas Simples</button>
      <button data-mineiro-bind="menu.categorias.aros-de-cebolla.boton">Aros de Cebolla</button>
    </div>

    <!-- Contenedor de Productos (se actualiza según la categoría seleccionada) -->
    <div class="products-container" data-mineiro-section="Todas Las Pizzas" data-mineiro-category-display></div>
  </div>

  <!-- Script Mineiro Engine -->
  <script src="https://pizzeria-kairos.vercel.app/mineiro-engine.js"></script>
</body>
</html>
```

## Configuración en el Panel de Administración

Para personalizar los valores de cada categoría, usa el editor de configuración del sitio (`SiteConfigEditor`) y añade la siguiente estructura en `site_config`:

```json
{
  "menu": {
    "categorias": {
      "tradicionales": {
        "boton": "🍕 Tradicionales",
        "icono": "🍕",
        "titulo": "Pizzas Tradicionales"
      },
      "de-casa": {
        "boton": "🏠 De Casa",
        "icono": "🏠",
        "titulo": "Especialidades de la Casa"
      },
      "con-carnes": {
        "boton": "🥩 Con Carnes",
        "icono": "🥩",
        "titulo": "Pizzas con Carnes"
      },
      "marinas": {
        "boton": "🐟 Marinas",
        "icono": "🐟",
        "titulo": "Pizzas Marinas"
      },
      "vegetarianas": {
        "boton": "🥗 Vegetarianas",
        "icono": "🥗",
        "titulo": "Opciones Vegetarianas"
      },
      "pan-de-ajo": {
        "boton": "🧄 Pan de Ajo",
        "icono": "🧄",
        "titulo": "Pan de Ajo"
      },
      "rolls": {
        "boton": "🌯 Rolls",
        "icono": "🌯",
        "titulo": "Rolls"
      },
      "hamburguesas": {
        "boton": "🍔 Hamburguesas",
        "icono": "🍔",
        "titulo": "Hamburguesas"
      },
      "papas-cargadas": {
        "boton": "🍟 Papas Cargadas",
        "icono": "🍟",
        "titulo": "Papas Cargadas"
      },
      "papas-simples": {
        "boton": "🥔 Papas Simples",
        "icono": "🥔",
        "titulo": "Papas Simples"
      },
      "aros-de-cebolla": {
        "boton": "🧅 Aros de Cebolla",
        "icono": "🧅",
        "titulo": "Aros de Cebolla"
      }
    }
  }
}
```

## Notas Importantes

1. **Filtrado Automático**: Los botones con `data-mineiro-bind="menu.categorias.*.boton"` automáticamente filtran los productos cuando se hace clic.

2. **Coincidencia de Categorías**: El sistema compara el slug de la categoría con el campo `categoria` del producto. Por ejemplo:
   - Slug: `tradicionales` → busca productos con categoría "Tradicionales"
   - Slug: `de-casa` → busca productos con categoría "De Casa"

3. **Valores por Defecto**: Si no configuras valores personalizados en `site_config`, el sistema usa el slug convertido a título (ej: "tradicionales" → "Tradicionales").

4. **Agregar Productos**: En el panel de administración, asegúrate de que el campo "Categoría" del producto coincida exactamente con el nombre de la categoría (respetando mayúsculas).

## Preguntas Frecuentes

**P: ¿Por qué mis productos no aparecen en una categoría?**  
R: Verifica que el campo `categoria` del producto coincida exactamente con el nombre de la categoría. El sistema hace una comparación case-insensitive pero debe coincidir.

**P: ¿Puedo agregar más categorías?**  
R: Sí, simplemente agrega productos con una nueva categoría y usa el formato `menu.categorias.{nuevo-slug}.boton` en tu HTML.

**P: ¿Cómo cambio los íconos?**  
R: Edita el campo `icono` en la configuración del sitio (site_config.menu.categorias.{slug}.icono).
