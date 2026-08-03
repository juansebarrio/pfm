# Ficha de App Store — Fin de mes

Todo lo que se pega en App Store Connect cuando la cuenta esté activa.
Los límites de caracteres van anotados; los textos ya los respetan.

## Identidad

- **Nombre** (30 máx): `Fin de mes`
  - Si está tomado: `Fin de mes — sobres` o `Fin de mes: tu presupuesto`
- **Subtítulo** (30 máx): `Presupuesto por sobres`
- **Bundle ID**: `com.juansebarrio.findemes`
- **SKU**: `findemes-ios`
- **Categoría principal**: Finanzas · **Secundaria**: Productividad
- **Precio**: Gratis
- **Clasificación**: 4+ (sin contenido sensible)

## Descripción (4000 máx)

```
Fin de mes es la app de plata pensada para Argentina: presupuesto por
sobres, tarjetas con ciclos reales y una vista clara de cuánto te queda
para llegar sin sobresaltos a fin de mes.

CÓMO FUNCIONA
Cada mes le ponés un monto a cada partida — alquiler, súper, salidas,
ahorro — como sobres de plata. La app te muestra cuánto queda en total y
en cada sobre, con el ritmo del mes: qué porcentaje gastaste contra
cuántos días pasaron.

CARGÁ GASTOS EN SEGUNDOS
• A mano: teclado numérico, importe, categoría, listo.
• Con la cámara: sacale una foto al ticket o comprobante y el asistente
  arma el movimiento — vos solo confirmás. Las fotos se leen y se
  descartan: no se guardan.
• Lo que entra sin categoría espera en la bandeja de entrada; nada se
  pierde ni se categoriza solo.

TARJETAS COMO LAS DE ACÁ
Cierre, vencimiento y cuotas de verdad. Cada consumo cae en el resumen
que corresponde, las cuotas devengan mes a mes y la app te avisa antes
del cierre. Podés conciliar cada resumen contra el del banco.

DEL HOGAR O SOLO TUYO
Compartí el presupuesto con los adultos de tu hogar. Lo personal es
tuyo: no aparece en las listas ni en los totales de nadie más. Lo elegís
al cargar cada movimiento.

TU PATRIMONIO, COMPLETO
Dólar MEP, billete, CEDEARs, FCI, cripto y plazos fijos, valuados al
tipo de cambio del día, con la composición de tu cartera.

PREGUNTALE A TUS NÚMEROS
El asistente te dice cómo venís y contesta con tus datos reales: cuánto
va el súper, qué partidas te sobraron, cómo armar el mes que viene.
Orientación general con IA — no es asesoramiento financiero profesional.

PRIVACIDAD PRIMERO
Tus datos son tuyos: acceso por hogar a nivel base de datos, borrado de
cuenta desde la app y sin venta de datos a terceros. Face ID para que
solo vos veas tus números.
```

## Palabras clave (100 máx, separadas por coma, sin espacios)

```
presupuesto,gastos,finanzas,sobres,tarjeta,cuotas,ahorro,plata,sueldo,hogar,dolar,mep
```
(96 caracteres)

## Texto promocional (170 máx)

```
Presupuesto por sobres, tarjetas con cierres y cuotas de verdad, y un
asistente que lee tus tickets. Llegá sin sobresaltos a fin de mes.
```

## URLs

- **Soporte**: `https://pfm.js80.studio/soporte`
- **Política de privacidad**: `https://pfm.js80.studio/privacidad`
- **Marketing** (opcional): `https://pfm.js80.studio`

## App Privacy (cuestionario)

Data collection: **sí se recolecta**, vinculada a la identidad:

| Tipo | Dato | Uso | Vinculado | Tracking |
|---|---|---|---|---|
| Contact Info | Email address | App Functionality (cuenta) | Sí | No |
| Financial Info | Other financial info (movimientos, presupuesto que carga el usuario) | App Functionality | Sí | No |
| User Content | Photos (comprobantes: se procesan y descartan, no se almacenan) | App Functionality | No | No |
| Identifiers | User ID | App Functionality | Sí | No |

- Tracking (ATT): **No** — no hay tracking entre apps ni venta de datos.
- La web usa Plausible (sin cookies, anónimo) — no aplica al binario iOS.

## Notas para el revisor (Review Notes)

```
Fin de mes is a personal/household budgeting app for Argentina
(Spanish-only UI, es-AR).

DEMO ACCESS (no signup needed): on the login screen tap
"Ver demo de prueba" — it opens a fully seeded demo household
(budget, transactions, credit-card cycles, portfolio) in one tap.

Alternatively, sign up with any email: a confirmation email is sent
(custom SMTP, verified domain) and account deletion is available in
the app under Hogar → "Borrar mi cuenta" (guideline 5.1.1(v)).

The AI assistant answers questions about the user's own data and can
read a receipt photo to prefill a transaction; photos are processed
and discarded, never stored. The app shows a disclaimer that this is
general guidance, not professional financial advice.

No payments, no subscriptions, no third-party login required.
```

## Checklist de envío (cuando la cuenta esté activa)

1. Xcode → Settings → Accounts → agregar Apple ID con el equipo pago.
2. App Store Connect → Apps → **+** → New App (datos de arriba).
3. Archive + upload (receta en el repo; la corre Claude).
4. Subir capturas 6.9" (design/appstore/capturas-6.9/).
5. Pegar textos de esta ficha + App Privacy + Review Notes.
6. Export compliance: ya declarado en el binario
   (`usesNonExemptEncryption: false`) — no pregunta nada.
7. Submit for Review.
