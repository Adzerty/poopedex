/**
 * Ajout d'une toilette user — bouton ➕ sur la carte.
 *
 * Le flow utilise `window.prompt()` pour saisir le nom (optionnel).
 * On stubbe ce dialog côté test.
 */
describe('Ajout de toilette', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
  });

  it("ajoute une toilette avec un nom à la position GPS courante", () => {
    cy.stubDialogs({ promptValue: 'Spot du parc' });
    cy.visit('/');
    cy.wait('@me');

    cy.get('[aria-label="Ajouter une toilette ici"]').click();

    cy.wait('@addToilet').its('request.body').should('deep.equal', {
      lat: 48.8585,
      lng: 2.347,
      name: 'Spot du parc',
    });
    cy.contains('🚽 Toilette ajoutée').should('be.visible');
  });

  it("ajoute une toilette sans nom quand le prompt est annulé", () => {
    cy.stubDialogs({ promptValue: null });
    cy.visit('/');
    cy.wait('@me');

    cy.get('[aria-label="Ajouter une toilette ici"]').click();

    cy.wait('@addToilet').then((interception) => {
      expect(interception.request.body).to.deep.include({ lat: 48.8585, lng: 2.347 });
      expect(interception.request.body.name).to.be.undefined;
    });
  });

  it("affiche un toast si la limite quotidienne est atteinte (429)", () => {
    cy.stubDialogs({ promptValue: 'spam' });
    cy.intercept('POST', 'http://localhost:3000/toilets', {
      statusCode: 429,
      body: { error: 'daily_limit', message: 'Une seule toilette par jour.' },
    }).as('addLimited');

    cy.visit('/');
    cy.wait('@me');
    cy.get('[aria-label="Ajouter une toilette ici"]').click();
    cy.wait('@addLimited');
    cy.contains('Une seule toilette par jour.').should('be.visible');
  });

  it("affiche un toast si une toilette existe à moins de 100m (409)", () => {
    cy.stubDialogs({ promptValue: 'doublon' });
    cy.intercept('POST', 'http://localhost:3000/toilets', {
      statusCode: 409,
      body: { error: 'duplicate_nearby', message: 'Toilette déjà existante à proximité.' },
    }).as('addDup');

    cy.visit('/');
    cy.wait('@me');
    cy.get('[aria-label="Ajouter une toilette ici"]').click();
    cy.wait('@addDup');
    cy.contains('Toilette déjà existante à proximité.').should('be.visible');
  });
});
