/**
 * Suite Admin — gate, listes, suppression de toilette, position simulée.
 */
describe('Admin - gate', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
  });

  it("redirige un user non-admin loin de /admin", () => {
    cy.loginAs('alice');
    cy.visit('/admin');
    cy.wait('@me');
    cy.location('pathname').should('eq', '/');
  });

  it("redirige un user non-admin loin de /admin/toilets", () => {
    cy.loginAs('alice');
    cy.visit('/admin/toilets');
    cy.wait('@me');
    cy.location('pathname').should('eq', '/');
  });

  it("affiche l'onglet Admin dans la BottomNav pour un admin", () => {
    cy.intercept('GET', 'http://localhost:3000/users/me', { fixture: 'profile-admin.json' }).as(
      'adminMe',
    );
    cy.loginAs('admin');
    cy.visit('/profile');
    cy.wait('@adminMe');
    cy.get('nav').contains('Admin').should('be.visible');
  });
});

describe('Admin - liste des toilettes', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.intercept('GET', 'http://localhost:3000/users/me', { fixture: 'profile-admin.json' }).as(
      'adminMe',
    );
    cy.loginAs('admin');
    cy.visit('/admin/toilets');
    cy.wait(['@adminMe', '@adminToilets']);
  });

  it('affiche la liste avec la source (OSM/User) et le créateur', () => {
    cy.contains('Toilettes Châtelet').should('be.visible');
    cy.contains('Spot perso').parent().contains('User');
    cy.contains('Spot perso').parent().contains('par alice');
  });

  it("indique visuellement les toilettes supprimées", () => {
    cy.contains('supprimée').should('be.visible');
  });

  it('navigue vers la carte centrée en cliquant sur une toilette', () => {
    cy.contains('Toilettes Châtelet').click();
    cy.location('search').should('include', 'id=10000000-0000-0000-0000-000000000001');
  });
});

describe('Admin - liste des utilisateurs', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.intercept('GET', 'http://localhost:3000/users/me', { fixture: 'profile-admin.json' }).as(
      'adminMe',
    );
    cy.loginAs('admin');
    cy.visit('/admin/users');
    cy.wait(['@adminMe', '@adminUsers']);
  });

  it("liste les users avec leur email et l'indicateur ADMIN", () => {
    cy.contains('admin@poopedex.test').should('be.visible');
    cy.contains('alice').should('be.visible');
    cy.contains('admin').parent().contains('ADMIN').should('exist');
  });

  it("ouvre le profil admin d'un utilisateur en cliquant", () => {
    cy.contains('alice').click();
    cy.location('pathname').should('eq', '/admin/users/00000000-0000-0000-0000-00000000aaaa');
  });
});

describe('Admin - suppression de toilette depuis la fiche', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.intercept('GET', 'http://localhost:3000/users/me', { fixture: 'profile-admin.json' }).as(
      'adminMe',
    );
    cy.loginAs('admin');
  });

  it("supprime la toilette après confirmation et ferme la fiche", () => {
    cy.stubDialogs({ confirm: true });
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait(['@adminMe', '@toiletDetail']);
    cy.contains('button', 'Supprimer cette toilette').click();
    cy.wait('@adminDeleteToilet').its('request.url').should('include', '10000000-0000-0000-0000-000000000001');
    cy.contains('h2', 'Toilettes Châtelet').should('not.exist');
  });

  it("ne fait rien si la confirmation est refusée", () => {
    cy.stubDialogs({ confirm: false });
    let called = false;
    cy.intercept('DELETE', 'http://localhost:3000/admin/toilets/*', () => {
      called = true;
    });
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait(['@adminMe', '@toiletDetail']);
    cy.contains('button', 'Supprimer cette toilette').click();
    cy.wait(200).then(() => expect(called).to.be.false);
    // L'overlay 'bg-black/30' couvre le h2 — `exist` suffit pour prouver que
    // la fiche est encore montée (i.e. la suppression n'a pas fermé la sheet).
    cy.contains('h2', 'Toilettes Châtelet').should('exist');
  });
});

describe('Admin - position simulée sur la carte', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.intercept('GET', 'http://localhost:3000/users/me', { fixture: 'profile-admin.json' }).as(
      'adminMe',
    );
    cy.loginAs('admin');
  });

  it("toggle le bouton 🎭 et affiche l'indicateur orange", () => {
    cy.visit('/');
    cy.wait('@adminMe');
    cy.get('[aria-label="Position simulée (admin)"]').click();
    cy.contains('Position simulée').should('be.visible');

    cy.get('[aria-label="Position simulée (admin)"]').click();
    cy.contains('Position simulée').should('not.exist');
  });

  it("autorise le check-in admin même à distance (mention 'mode admin')", () => {
    cy.mockGeolocation({ lat: 48.85, lng: 2.32, accuracy: 10 }); // ~2km
    cy.visit('/?lat=48.8585&lng=2.3470&id=10000000-0000-0000-0000-000000000001');
    cy.wait(['@adminMe', '@toiletDetail']);
    cy.contains('mode admin').should('be.visible');
    cy.contains('button', '💩 Enregistrer mon poop').should('exist');
  });
});
