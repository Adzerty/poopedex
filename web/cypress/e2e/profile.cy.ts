/**
 * Profil personnel (/profile) — stats, badges.
 */
describe('Profil personnel', () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
  });

  it('affiche les stats, le score de rareté et les badges', () => {
    cy.visit('/profile');
    cy.wait('@me');

    cy.contains('h1', 'alice').should('be.visible');
    cy.contains('1 337 pts').should('be.visible'); // toLocaleString fr-FR
    cy.contains('Poops').parent().contains('42');
    cy.contains('Toilettes').parent().contains('17');
    cy.contains('Notes').parent().contains('12');

    cy.contains('Premier poop').should('be.visible');
  });

  it('affiche les badges verrouillés avec leur progression vers la cible', () => {
    cy.visit('/profile');
    cy.wait('@me');

    // Section "À débloquer"
    cy.contains('À débloquer').should('be.visible');

    // Badge débloqué → flag data-unlocked=true
    cy.get('[data-testid="badge-first-poop"]').should('have.attr', 'data-unlocked', 'true');

    // Badge verrouillé → flag data-unlocked=false + barre de progression visible
    cy.get('[data-testid="badge-explorer_50"]')
      .should('have.attr', 'data-unlocked', 'false')
      .within(() => {
        cy.contains('Grand voyageur').should('be.visible');
        cy.contains('17 / 50').should('be.visible'); // current / target (fr-FR)
        cy.get('[role="progressbar"]').should('have.attr', 'aria-valuenow', '34'); // 17/50
      });

    cy.get('[data-testid="badge-score_10k"]')
      .should('have.attr', 'data-unlocked', 'false')
      .within(() => {
        cy.contains('1 337 / 10 000').should('be.visible');
        cy.get('[role="progressbar"]').should('have.attr', 'aria-valuenow', '13'); // 1337/10000
      });
  });

  it("n'affiche pas la section 'À débloquer' quand tout est débloqué", () => {
    cy.intercept('GET', 'http://localhost:3000/users/me', {
      body: {
        id: '00000000-0000-0000-0000-00000000aaaa',
        username: 'alice',
        avatarUrl: null,
        memberSince: '2026-01-15T10:00:00.000Z',
        stats: {
          totalPoops: 42,
          distinctToilets: 17,
          totalRatings: 12,
          totalPoints: 1337,
          maxRarityScore: 250,
        },
        badges: [
          {
            code: 'first-poop',
            name: 'Premier poop',
            description: 'Tu as enregistré ton premier poop.',
            icon: '🥇',
            unlockedAt: '2026-01-15T11:00:00.000Z',
            progress: { current: 42, target: 1 },
          },
        ],
        friendshipStatus: 'self',
      },
    }).as('meAllUnlocked');
    cy.visit('/profile');
    cy.wait('@meAllUnlocked');

    cy.contains('Premier poop').should('be.visible');
    cy.contains('À débloquer').should('not.exist');
  });

  it("affiche un message d'erreur si /users/me crash", () => {
    cy.intercept('GET', 'http://localhost:3000/users/me', { statusCode: 500, body: {} }).as('meErr');
    cy.visit('/profile');
    cy.wait('@meErr');
    cy.contains('Impossible de charger ton profil').should('be.visible');
  });
});

/**
 * Profil public (/users/:id) — bouton d'amitié contextuel.
 */
describe("Profil public d'un autre user", () => {
  beforeEach(() => {
    cy.mockApi();
    cy.mockGeolocation();
    cy.loginAs('alice');
  });

  it("affiche 'Ajouter en ami' quand friendshipStatus = none", () => {
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userBob');
    cy.contains('h1', 'bob').should('be.visible');
    cy.contains('button', '+ Ajouter en ami').should('be.visible').click();
    cy.wait('@sendFriendReq').its('request.body').should('deep.equal', {
      userId: '00000000-0000-0000-0000-00000000bbbb',
    });
  });

  it('affiche les badges débloqués ET les badges à débloquer du profil consulté', () => {
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userBob');
    cy.get('[data-testid="badge-first-poop"]').should('have.attr', 'data-unlocked', 'true');
    cy.get('[data-testid="badge-regular_25"]')
      .should('have.attr', 'data-unlocked', 'false')
      .within(() => cy.contains('10 / 25').should('be.visible'));
  });

  it("affiche 'Demande envoyée' quand pending_outgoing", () => {
    cy.intercept('GET', 'http://localhost:3000/users/00000000-0000-0000-0000-00000000bbbb', {
      body: { ...fakeBob(), friendshipStatus: 'pending_outgoing' },
    }).as('userPending');
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userPending');
    cy.contains('button', 'Demande envoyée').should('be.visible');
  });

  it("permet d'accepter une demande entrante depuis le profil", () => {
    cy.intercept('GET', 'http://localhost:3000/users/00000000-0000-0000-0000-00000000bbbb', {
      body: { ...fakeBob(), friendshipStatus: 'pending_incoming' },
    }).as('userIncoming');
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userIncoming');
    cy.contains('button', 'Accepter').click();
    cy.wait('@acceptFriend');
  });

  it("permet de retirer un ami depuis son profil", () => {
    cy.intercept('GET', 'http://localhost:3000/users/00000000-0000-0000-0000-00000000bbbb', {
      body: { ...fakeBob(), friendshipStatus: 'accepted' },
    }).as('userAccepted');
    cy.stubDialogs({ confirm: true });
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userAccepted');
    cy.contains('button', '✓ Ami — retirer').click();
    cy.wait('@removeFriend');
  });

  it('cache toute action sur son propre profil (status=self)', () => {
    cy.intercept('GET', 'http://localhost:3000/users/00000000-0000-0000-0000-00000000bbbb', {
      body: { ...fakeBob(), friendshipStatus: 'self' },
    }).as('userSelf');
    cy.visit('/users/00000000-0000-0000-0000-00000000bbbb');
    cy.wait('@userSelf');
    cy.contains('button', '+ Ajouter en ami').should('not.exist');
  });
});

function fakeBob() {
  return {
    id: '00000000-0000-0000-0000-00000000bbbb',
    username: 'bob',
    avatarUrl: null,
    memberSince: '2026-02-01T00:00:00.000Z',
    stats: {
      totalPoops: 10,
      distinctToilets: 5,
      totalRatings: 3,
      totalPoints: 250,
      maxRarityScore: 80,
    },
    badges: [],
  };
}
