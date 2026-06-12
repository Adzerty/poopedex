import { defineConfig } from 'cypress';

/**
 * Config Cypress — orientée E2E mobile-first.
 *
 * Stratégie : on stubbe TOUTES les routes `/<route>` de l'API via `cy.intercept()`
 * (cf. `cypress/support/commands.ts` → `mockApi`). Pas de backend réel ni de DB
 * pendant les tests : déterministe, rapide (<30s), pas de docker.
 *
 * Le serveur Vite tourne sur 5173 (cf. `vite.config.ts`). En mode `test` on lui
 * passe un style MapLibre minimal via `VITE_MAP_STYLE` pour neutraliser le
 * fetch des tuiles OpenFreeMap (cf. `cypress/support/commands.ts`).
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    // Viewport iPhone 13 — l'appli est mobile-first / PWA.
    viewportWidth: 390,
    viewportHeight: 844,
    video: false,
    screenshotOnRunFailure: true,
    // L'appli sait répondre vite quand on stubbe ; un retry sur la CI absorbe
    // les rares timings React Query qui sautent une frame.
    retries: { runMode: 2, openMode: 0 },
    setupNodeEvents() {
      // hook events here si besoin (tasks, plugins…) — vide pour l'instant.
    },
  },
});
