/**
 * Auth — login / register / logout.
 *
 * On vérifie aussi que la session est bien persistée dans `localStorage`
 * (clé `poopedex.session`) puisque c'est ce qui permet au front de rester
 * connecté à travers les rechargements.
 */
describe('Authentification', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
  });

  it("affiche l'écran d'auth quand pas de session", () => {
    cy.visit('/');
    cy.contains('h1', 'Poopedex').should('be.visible');
    cy.contains('button', 'Se connecter').should('be.visible');
  });

  it('connecte un user avec des bons identifiants', () => {
    cy.visit('/');
    cy.get('input[placeholder="Pseudo ou email"]').type('alice');
    cy.get('input[placeholder="Mot de passe"]').type('good-pass');
    cy.contains('button', 'Se connecter').click();

    cy.wait('@login').its('request.body').should('deep.equal', {
      identifier: 'alice',
      password: 'good-pass',
    });

    // Une fois loggé on est sur la carte → fetch profil.
    cy.wait('@me');
    cy.window().its('localStorage').invoke('getItem', 'poopedex.session').should('contain', 'test-access-token');
  });

  it('affiche le message d\'erreur quand les identifiants sont mauvais', () => {
    cy.visit('/');
    cy.get('input[placeholder="Pseudo ou email"]').type('alice');
    cy.get('input[placeholder="Mot de passe"]').type('wrong');
    cy.contains('button', 'Se connecter').click();

    cy.wait('@login');
    cy.contains('Identifiants invalides').should('be.visible');
    // Toujours sur l'écran d'auth.
    cy.contains('h1', 'Poopedex').should('be.visible');
  });

  it("bascule entre les modes connexion et inscription", () => {
    cy.visit('/');
    cy.contains('Pas de compte ? Inscris-toi').click();
    cy.get('input[type="email"]').should('be.visible');
    cy.contains('button', "S'inscrire").should('be.visible');

    cy.contains('Déjà un compte ? Connecte-toi').click();
    cy.get('input[type="email"]').should('not.exist');
  });

  it("inscrit un nouvel utilisateur", () => {
    cy.visit('/');
    cy.contains('Pas de compte ? Inscris-toi').click();
    cy.get('input[placeholder="Pseudo"]').type('newbie');
    cy.get('input[type="email"]').type('newbie@poopedex.test');
    cy.get('input[placeholder="Mot de passe"]').type('hunter22hunter22');
    cy.contains('button', "S'inscrire").click();

    cy.wait('@register').its('request.body').should('deep.equal', {
      username: 'newbie',
      email: 'newbie@poopedex.test',
      password: 'hunter22hunter22',
    });
    cy.wait('@me');
  });

  it("affiche l'erreur de validation à l'inscription", () => {
    cy.visit('/');
    cy.contains('Pas de compte ? Inscris-toi').click();
    cy.get('input[placeholder="Pseudo"]').type('xx');
    cy.get('input[type="email"]').type('x@y.z');
    cy.get('input[placeholder="Mot de passe"]').type('whatever12');
    cy.contains('button', "S'inscrire").click();

    cy.wait('@register');
    cy.contains('Pseudo trop court').should('be.visible');
  });

  it('reste connecté après reload (session en localStorage)', () => {
    cy.loginAs('alice');
    cy.visit('/');
    cy.wait('@me');
    cy.reload();
    cy.wait('@me');
    cy.contains('Poopedex').should('not.exist'); // pas l'écran d'auth
  });

  it("permet de se déconnecter depuis le profil", () => {
    cy.loginAs('alice');
    cy.visit('/profile');
    cy.wait('@me');

    cy.contains('button', 'Se déconnecter').click();
    cy.contains('h1', 'Poopedex').should('be.visible');
    cy.window().its('localStorage').invoke('getItem', 'poopedex.session').should('be.null');
  });
});
