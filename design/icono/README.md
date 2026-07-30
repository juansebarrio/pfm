# Ícono de app — Fin de mes

Marca **la hoja que se arranca** sobre tile verde. Tile `#4FA37F`, hoja `#F2EFE9`, pliegue `#2F6F55`.
Todos los PNG son **cuadrados, sin transparencia y sin esquinas redondeadas**: cada sistema aplica su propia máscara.

## iOS — `ios/`
`AppIcon-1024.png` es el que sube a App Store Connect (1024×1024, sin alfa). El resto son los tamaños del asset catalog:
180 (iPhone @3x) · 167 (iPad Pro) · 152 (iPad @2x) · 120 (iPhone @2x / Spotlight @3x) · 87 · 80 · 60 · 58 · 40 · 29.
En Xcode: arrastrar cada archivo a su casillero en `Assets.xcassets/AppIcon`. `AppIcon-1024.svg` queda como fuente vectorial.

## Android — `android/`
- `play-store-512.png` — ficha de Google Play (512×512).
- `ic_launcher-192.png` — legacy launcher.
- `adaptive-foreground-432.png` + `adaptive-background-432.png` — ícono adaptativo. La marca ocupa 46 % del lienzo: entra completa en la zona seguraque Android recorta (círculo, squircle o gota).

## Web y PWA — `web/`
- `favicon.svg` (preferido por navegadores modernos) · `favicon-32.png` · `favicon-16.png`
- `apple-touch-icon-180.png`
- `icon-512/384/192/144/96/72/48.png`
- `maskable-512.png` — marca al 44 %, sobrevive el recorte circular de Android/Chrome.
- `site.webmanifest` — rutas relativas a la raíz; ajustar si los íconos van en un subdirectorio.

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#4FA37F">
```

## Reglas
La marca ocupa el 62 % del tile en tamaños normales y sube a 68–74 % en los chicos (≤96 px) para no perder el pliegue. Nunca redondear los PNG a mano, nunca poner sombra, nunca cambiar el verde del tile.
