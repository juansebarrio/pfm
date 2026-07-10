# Sobres

PFM personal y familiar para Argentina (nombre provisorio, pendiente de INPI).
Presupuesto mensual por partidas en dos ámbitos (hogar compartido y personal
privado), tarjetas con ciclos reales de cierre y vencimiento, compras en cuotas,
y patrimonio con tipo de cambio siempre visible. Mobile-first, criterio contable
por devengado. Proyecto de estudio de JS80.

- `DESIGN_AUDIT.md` — auditoría del export de diseño (tokens, componentes, dataset).
- `DESIGN_NOTES.md` — decisiones anotadas, mejoras aplicadas y propuestas pendientes.
- `design/` — el export de Claude Design, fuente de verdad visual.

## Levantar local

Requisitos: Node 20+, pnpm, un proyecto de Supabase (región São Paulo).

```bash
pnpm install
cp .env.example .env.local   # completar con las keys del proyecto
pnpm dev                     # http://localhost:3000
```

## Migraciones

Las migraciones SQL versionadas viven en `supabase/migrations/` (desde la
tanda 2). Se aplican en orden en el SQL editor de Supabase o con la CLI:

```bash
supabase db push   # con el proyecto linkeado
```

## Seed

```bash
pnpm seed          # reproduce el dataset del export: hogar Coghlan, julio 2026
```

Usuarios de prueba que crea el seed: ver la salida del comando (Juanse y Vale,
con contraseñas impresas en consola al crearlos).

## Verificaciones

```bash
pnpm build         # build de producción
pnpm lint          # eslint
pnpm test          # vitest: plata en centavos, ciclos, cuotas, proyección
pnpm rls:check     # verifica aislamiento RLS entre hogares y entre miembros
```

## PWA

Instalable en Android e iOS (manifest + service worker mínimo). En iOS las
PWA tienen limitaciones conocidas: sin push, almacenamiento evictable si la
app no se usa por semanas, y la instalación es manual desde Compartir →
"Agregar a inicio". Offline real queda para una fase siguiente.
