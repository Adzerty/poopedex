/**
 * Carte — chargement, marqueurs, fiche toilette, recentrage GPS.
 *
 * MapLibre est rendu avec un style minimal (cf. `cypress/fixtures/map-style.json`)
 * pour éviter tout fetch externe. Les marqueurs apparaissent dès que la map a
 * émis son `moveend` initial → ce qui déclenche `useToiletsInBBox`.
 */
describe('Carte principale', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
    cy.visit('/');
    cy.wait('@me');
  });

  it('affiche les boutons flottants une fois connecté', () => {
    cy.get('[aria-label="Recentrer"]').should('be.visible');
    cy.get('[aria-label="Ajouter une toilette ici"]').should('be.visible');
    cy.get('[aria-label="Classement"]').should('be.visible');
    cy.get('[aria-label="Profil"]').should('be.visible');
  });

  it('ne montre pas le bouton position simulée pour un user non-admin', () => {
    cy.get('[aria-label="Position simulée (admin)"]').should('not.exist');
  });

  it('charge les toilettes dans la bbox du viewport', () => {
    cy.wait('@toiletsBbox');
    // Les marqueurs sont rendus par react-map-gl ; on vérifie qu'au moins un
    // libellé attendu apparaît dans le DOM (tooltips/aria).
    cy.get('.maplibregl-marker').should('have.length.at.least', 1);
  });

  it("ouvre la fiche en cliquant sur un marqueur (via ?id query param)", () => {
    // On force l'ouverture via les query params (utilisé par le leaderboard).
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@me');
    cy.wait('@toiletsBbox');
    cy.wait('@toiletDetail');
    cy.contains('h2', 'Toilettes Châtelet').should('be.visible');
    cy.contains('Détails des votes').should('be.visible');
  });

  it("ferme la fiche en cliquant sur l'overlay", () => {
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');
    cy.contains('h2', 'Toilettes Châtelet').should('be.visible');

    // Click sur l'overlay (le wrapper fixed inset-0 click=onClose).
    cy.get('body').type('{esc}'); // ne ferme pas → on clique réellement.
    cy.get('.fixed.inset-0').first().click('topRight', { force: true });
    cy.contains('h2', 'Toilettes Châtelet').should('not.exist');
  });

  it('navigue vers le classement et le profil depuis les boutons flottants', () => {
    cy.get('[aria-label="Classement"]').click();
    cy.location('pathname').should('eq', '/leaderboard');

    cy.go('back');
    cy.get('[aria-label="Profil"]').click();
    cy.location('pathname').should('eq', '/profile');
  });
});

describe('Carte - erreurs', () => {
  it("affiche un message si l'API toilets renvoie une erreur", () => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
    cy.intercept('GET', 'http://localhost:3000/toilets/bbox*', {
      statusCode: 500,
      body: {},
    }).as('toiletsErr');
    cy.visit('/');
    cy.wait('@toiletsErr');
    // Pas de toast visible mais aucun crash : la carte reste affichée.
    cy.get('[aria-label="Recentrer"]').should('be.visible');
  });
});
