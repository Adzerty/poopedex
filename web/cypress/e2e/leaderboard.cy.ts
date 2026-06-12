/**
 * Leaderboard — onglet Toilettes vs Chieurs, scope Global vs Amis.
 */
describe('Leaderboard', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
    cy.visit('/leaderboard');
    cy.wait('@me');
  });

  it('affiche le classement des toilettes par défaut', () => {
    cy.wait('@lbToilets');
    cy.contains('h1', '🏆 Classement').should('be.visible');
    cy.contains('Toilettes Châtelet').should('be.visible');
    cy.contains('Toilettes Hôtel de Ville').should('be.visible');
    // rang 1
    cy.get('ol li').first().contains('1');
  });

  it('navigue vers la carte centrée sur une toilette du classement', () => {
    cy.wait('@lbToilets');
    cy.contains('Toilettes Châtelet').click();
    cy.location('pathname').should('eq', '/');
    cy.location('search').should('include', 'id=10000000-0000-0000-0000-000000000001');
  });

  it('bascule sur le classement des chieurs (scope global par défaut)', () => {
    cy.contains('button', '💩 Chieurs').click();
    cy.wait('@lbUsersGlobal');
    cy.contains('bob').should('be.visible');
    cy.contains('9 001').should('be.visible'); // toLocaleString fr-FR de 9001
  });

  it("filtre sur les amis quand on bascule sur le scope 'Amis'", () => {
    cy.contains('button', '💩 Chieurs').click();
    cy.wait('@lbUsersGlobal');
    cy.contains('button', '👥 Amis').click();
    cy.wait('@lbUsersFriends');
    cy.contains('dora').should('be.visible');
    cy.contains('bob').should('not.exist');
  });

  it("affiche un état vide quand aucun ami n'est classé", () => {
    cy.intercept('GET', 'http://localhost:3000/users/leaderboard*scope=friends*', {
      body: [],
    }).as('lbEmpty');
    cy.contains('button', '💩 Chieurs').click();
    cy.contains('button', '👥 Amis').click();
    cy.wait('@lbEmpty');
    cy.contains('Aucun ami classé').should('be.visible');
  });

  it("navigue vers le profil public d'un user du classement", () => {
    cy.contains('button', '💩 Chieurs').click();
    cy.wait('@lbUsersGlobal');
    cy.contains('bob').click();
    cy.location('pathname').should('eq', '/users/00000000-0000-0000-0000-00000000bbbb');
  });

  it('affiche un état d\'erreur si le fetch échoue', () => {
    cy.intercept('GET', 'http://localhost:3000/toilets/leaderboard*', {
      statusCode: 500,
      body: {},
    }).as('lbErr');
    cy.visit('/leaderboard');
    cy.wait('@lbErr');
    cy.contains('Impossible de charger le classement').should('be.visible');
  });
});
