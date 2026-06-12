/**
 * Check-in (poop) + notation depuis la fiche toilette.
 */
describe('Check-in et notation', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation(); // GPS pile sur la toilette de référence
    cy.loginAs('alice');
  });

  it("permet d'enregistrer un poop sans noter (lien discret)", () => {
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');
    cy.contains('Juste enregistrer sans noter').click();

    cy.wait('@checkin').its('request.body').should('deep.include', {
      lat: 48.8585,
      lng: 2.347,
      accuracy: 10,
    });
    cy.contains('Nouvelle toilette collectée').should('be.visible');
  });

  it("valide une notation complète (propreté + sécurité + flags + commentaire)", () => {
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');

    // Le bouton "Enregistrer mon poop" est désactivé tant qu'on n'a pas noté.
    cy.contains('button', '💩 Enregistrer mon poop').should('be.disabled');

    // 4 étoiles propreté, 5 étoiles sécurité — chaque étoile expose un
    // aria-label "<label> : <n> étoiles" (cf. `StarRating.tsx`).
    cy.get('button[aria-label="Propreté : 4 étoiles"]').click();
    cy.get('button[aria-label="Sécurité : 5 étoiles"]').click();

    cy.contains('button', '🧼 Savon').click();
    cy.contains('button', '🧻 Papier').click();
    cy.get('textarea').type('Top.');

    cy.contains('button', '💩 Enregistrer mon poop').should('not.be.disabled').click();

    cy.wait('@checkin').its('request.body.rating').should('deep.equal', {
      cleanliness: 4,
      safety: 5,
      hasSoap: true,
      hasToiletPaper: true,
      hasBin: false,
      hasMenstrualProducts: false,
      hasBabyChanging: false,
      comment: 'Top.',
    });
  });

  it("affiche le toast badge quand l'API renvoie newBadges", () => {
    cy.intercept('POST', 'http://localhost:3000/toilets/*/poops', {
      fixture: 'checkin-result-badge.json',
    }).as('checkinBadge');
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');
    cy.contains('Juste enregistrer sans noter').click();
    cy.wait('@checkinBadge');
    cy.contains('Badge débloqué').should('be.visible');
    cy.contains('Pépite rare').should('be.visible');
  });

  it("bloque le check-in quand on est trop loin", () => {
    cy.mockGeolocation({ lat: 48.85, lng: 2.32, accuracy: 10 }); // ~2km
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');
    cy.contains("Rapproche-toi de la toilette").should('be.visible');
    cy.contains('button', '💩 Enregistrer mon poop').should('not.exist');
  });

  it("affiche l'erreur si l'API rejette le check-in", () => {
    cy.intercept('POST', 'http://localhost:3000/toilets/*/poops', {
      statusCode: 400,
      body: { error: 'too_far', message: 'Tu es trop loin.' },
    }).as('checkinErr');
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait('@toiletDetail');
    cy.contains('Juste enregistrer sans noter').click();
    cy.wait('@checkinErr');
    cy.contains('Tu es trop loin.').should('be.visible');
  });
});
