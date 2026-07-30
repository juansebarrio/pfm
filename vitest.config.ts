import { defineConfig } from "vitest/config";

// Config mínima de vitest, con un solo motivo de existir: excluir los worktrees.
//
// POR QUÉ. Las tareas en paralelo de Claude Code crean worktrees dentro del
// repo (.claude/worktrees/<nombre>/), y cada uno es una COPIA completa del
// proyecto — con sus lib/dominio/*.test.ts incluidos. Sin esta exclusión,
// `vitest run` los levanta como si fueran del repo y el conteo se duplica: se
// vieron 246 tests en 17 archivos cuando el proyecto tiene 143 en 9. Un gate que
// mide dos repos a la vez no es un gate: pasa en verde con código de otra rama y
// falla por cambios que no son tuyos.
//
// El resto de los defaults quedan como estaban: no hay nada más que configurar.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/worktrees/**"],
  },
});
