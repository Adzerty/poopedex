/**
 * Écran Amis — demandes reçues/envoyées + liste d'amis.
 */
describe('Écran amis', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
    cy.visit('/friends');
    cy.wait('@me');
  });

  it('liste les demandes reçues, envoyées et la liste d\'amis', () => {
    cy.wait(['@friends', '@friendReqs', '@friendReqsSent']);

    cy.contains('Demandes reçues').should('be.visible');
    cy.contains('bob').should('be.visible'); // demande entrante

    cy.contains('Demandes envoyées').should('be.visible');
    cy.contains('charlie').should('be.visible'); // demande sortante

    cy.contains('Mes amis').should('be.visible');
    cy.contains('dora').should('be.visible');
    cy.contains('eve').should('be.visible');
  });

  it("accepte une demande entrante", () => {
    cy.wait('@friendReqs');
    cy.contains('bob').parent().parent().contains('button', 'Accepter').click();
    cy.wait('@acceptFriend').its('request.url').should('include', '00000000-0000-0000-0000-00000000bbbb');
  });

  it("refuse une demande entrante", () => {
    cy.wait('@friendReqs');
    cy.contains('bob').parent().parent().contains('button', 'Refuser').click();
    cy.wait('@declineFriend').its('request.url').should('include', '00000000-0000-0000-0000-00000000bbbb');
  });

  it('annule une demande envoyée', () => {
    cy.wait('@friendReqsSent');
    cy.contains('charlie').parent().parent().contains('button', 'Annuler').click();
    cy.wait('@removeFriend').its('request.url').should('include', '00000000-0000-0000-0000-00000000cccc');
  });

  it("retire un ami après confirmation", () => {
    cy.stubDialogs({ confirm: true });
    cy.visit('/friends'); // reload pour que le stub confirm prenne effet
    cy.wait('@friends');
    cy.contains('dora').parent().parent().contains('button', 'Retirer').click();
    cy.wait('@removeFriend').its('request.url').should('include', '00000000-0000-0000-0000-00000000dddd');
  });

  it("ne retire pas l'ami si la confirmation est refusée", () => {
    cy.stubDialogs({ confirm: false });
    cy.visit('/friends');
    cy.wait('@friends');
    let called = false;
    cy.intercept('DELETE', 'http://localhost:3000/friends/*', () => {
      called = true;
    });
    cy.contains('dora').parent().parent().contains('button', 'Retirer').click();
    cy.wait(150).then(() => expect(called).to.be.false);
  });

  it("affiche les états vides quand pas d'amis ni demandes", () => {
    cy.intercept('GET', 'http://localhost:3000/friends', { body: [] }).as('friendsEmpty');
    cy.intercept('GET', 'http://localhost:3000/friends/requests', { body: [] }).as('reqsEmpty');
    cy.intercept('GET', 'http://localhost:3000/friends/requests/sent', { body: [] }).as(
      'sentEmpty',
    );
    cy.visit('/friends');
    cy.wait(['@friendsEmpty', '@reqsEmpty', '@sentEmpty']);
    cy.contains('Aucune demande en attente').should('be.visible');
    cy.contains("Pas encore d'amis").should('be.visible');
  });

  it('badge nombre de demandes dans la BottomNav', () => {
    cy.wait('@friendReqs');
    cy.get('nav').contains('Amis').parent().find('span').contains('1').should('be.visible');
  });
});
