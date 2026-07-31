# Ficha de Play Store — Fin de mes

Todo lo que se pega en Google Play Console. La app es una TWA (Trusted Web
Activity) que envuelve https://pfm.js80.studio — el binario vive en `play/`
y el vínculo dominio↔app en `public/.well-known/assetlinks.json`.

## Identidad

- **Nombre** (30 máx): `Fin de mes`
- **Descripción corta** (80 máx):
  `Presupuesto por sobres, tarjetas con cierres y cuotas. Hecho para Argentina.`
- **Package**: `studio.js80.pfm.twa`
- **Categoría**: Finanzas
- **Precio**: Gratis, sin compras internas
- **Etiquetas**: presupuesto, finanzas personales

## Descripción completa (4000 máx)

La misma de `design/appstore/ficha.md` (sección "Descripción") — Play no
tiene campo de keywords, así que la descripción es lo que indexa: ya
menciona presupuesto, sobres, tarjetas, cuotas, dólar MEP, patrimonio.

## Assets gráficos

- **Ícono**: 512×512 → `public/iconos/icono-512.png` (ya existe)
- **Feature graphic** (obligatorio, 1024×500): `design/playstore/feature-graphic.png`
- **Capturas de teléfono** (mín. 2, 16:9 a 9:16): sirven las de
  `design/appstore/capturas-6.9/` tal cual (Play acepta 1320×2868)

## Data Safety (equivalente a App Privacy de Apple)

**¿Recolecta datos?** Sí. **¿Comparte datos con terceros?** No.
**¿Cifrado en tránsito?** Sí. **¿Se pueden pedir borrar?** Sí (desde la app,
Hogar → Borrar mi cuenta).

| Tipo | Dato | Propósito | Obligatorio |
|---|---|---|---|
| Info personal | Dirección de email | Funcionalidad de la app (cuenta) | Sí |
| Info financiera | Otra info financiera (movimientos y presupuesto que carga el usuario) | Funcionalidad de la app | Sí |
| Fotos y videos | Fotos (comprobantes: se procesan y descartan, no se almacenan) | Funcionalidad de la app | No |
| IDs de app | ID de usuario | Funcionalidad de la app | Sí |

Sin publicidad, sin venta de datos, sin tracking entre apps.
La web usa Plausible (analítica anónima sin cookies).

## Clasificación de contenido (cuestionario IARC)

Todas las respuestas en "No" (sin violencia, apuestas, contenido sexual,
etc.) → clasificación resultante: 3+ / PEGI 3 / Everyone.

- ¿App de finanzas? Sí → declara que NO da asesoramiento financiero
  regulado: es una herramienta de presupuesto personal (el asistente
  muestra el descargo "no es asesoramiento financiero profesional").

## Público objetivo

- Grupo etario: 18+ (app de finanzas personales)
- ¿Atrae a menores? No

## URLs y contacto

- **Política de privacidad**: `https://pfm.js80.studio/privacidad`
- **Sitio**: `https://pfm.js80.studio`
- **Email de contacto**: `contacto@juansebarrio.com`

## Testeo cerrado (requisito de cuenta personal nueva)

1. Play Console → Testing → Closed testing → crear track "beta".
2. Subir el `.aab` de `play/` (Claude lo genera; queda en
   `play/app-release-bundle.aab`).
3. Crear lista de emails con los 12+ testers y mandarles el link de
   opt-in que da la consola.
4. Los testers instalan desde Play y la app debe quedar instalada
   14 días seguidos (no hace falta que la usen a diario).
5. Cumplidos los 14 días con 12+ testers activos, aparece el botón
   "Apply for production" en la consola.

## Checklist de envío

1. Cuenta de Play Console (US$25, única vez).
2. Create app → nombre, idioma es-419, app gratuita.
3. Subir el .aab al track de testeo cerrado.
4. Completar Data Safety + clasificación + público con lo de arriba.
5. Ficha: descripción, ícono 512, feature graphic, capturas.
6. Invitar testers → esperar los 14 días → Apply for production.
