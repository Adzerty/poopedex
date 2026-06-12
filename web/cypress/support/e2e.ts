import './commands';

/**
 * Empêche les erreurs non critiques de MapLibre (WebGL inexistant en headless,
 * fetch des sprites/glyphes du style minimal) de faire planter un test sans
 * lien avec la carte. On loggue pour debug et on continue.
 */
Cypress.on('uncaught:exception', (err) => {
  const msg = err.message ?? '';
  if (
    msg.includes('WebGL') ||
    msg.includes('maplibre') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('AbortError')
  ) {
    return false;
  }
  // toute autre erreur fait planter le test (comportement par défaut).
  return undefined;
});
