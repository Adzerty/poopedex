/// <reference types="cypress" />

/**
 * Commandes custom pour tester Poopedex sans backend ni géoloc réelle.
 *
 * Pattern d'usage typique en début de test :
 *
 *   beforeEach(() => {
 *     cy.mockApi();           // intercepte toutes les routes /xxx
 *     cy.mockGeolocation();   // navigator.geolocation → Châtelet
 *     cy.loginAs('alice');    // pose la session dans localStorage
 *     cy.visit('/');
 *   });
 *
 * Les intercepts Cypress sont "last-wins" : un test peut donc surcharger une
 * réponse posée par `mockApi()` en re-déclarant son propre `cy.intercept` après.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mockApi(): Chainable<void>;
      loginAs(who: 'alice' | 'admin'): Chainable<void>;
      mockGeolocation(coords?: { lat: number; lng: number; accuracy?: number }): Chainable<void>;
      stubDialogs(opts?: { confirm?: boolean; promptValue?: string | null }): Chainable<void>;
    }
  }
}

// ───── État de pré-chargement (window:before:load) ──────────────────────────
//
// On enregistre UN SEUL listener `window:before:load` au chargement du fichier
// support (sinon chaque appel à `mockGeolocation` empile un listener → on
// finit par re-stubber un stub à chaque test, et ça casse).
//
// Les commandes ci-dessous se contentent de mettre à jour ces variables ; le
// listener relit l'état à chaque navigation.

interface BeforeLoadState {
  geo: { lat: number; lng: number; accuracy: number } | null;
  dialogs: { confirm: boolean; prompt: string | null } | null;
}

const beforeLoadState: BeforeLoadState = { geo: null, dialogs: null };

Cypress.on('window:before:load', (win) => {
  if (beforeLoadState.geo) {
    const c = beforeLoadState.geo;
    const pos: GeolocationPosition = {
      coords: {
        latitude: c.lat,
        longitude: c.lng,
        accuracy: c.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      } as GeolocationCoordinates,
      timestamp: Date.now(),
    };
    const geo = win.navigator.geolocation;
    if (geo) {
      // On remplace par des fonctions natives (pas cy.stub) pour éviter le
      // wrapping cumulatif d'un run à l'autre.
      geo.getCurrentPosition = ((success: PositionCallback) => success(pos)) as typeof geo.getCurrentPosition;
      geo.watchPosition = ((success: PositionCallback) => {
        success(pos);
        return 1;
      }) as typeof geo.watchPosition;
      geo.clearWatch = (() => undefined) as typeof geo.clearWatch;
    }
  }

  if (beforeLoadState.dialogs) {
    const { confirm, prompt } = beforeLoadState.dialogs;
    win.confirm = (() => confirm) as typeof win.confirm;
    win.prompt = (() => prompt) as typeof win.prompt;
  }
});

// Cypress isole chaque test mais le listener vit pour tout le fichier — on
// reset l'état entre tests pour éviter les fuites d'un test à l'autre.
beforeEach(() => {
  beforeLoadState.geo = null;
  beforeLoadState.dialogs = null;
});

// ───── Auth ─────────────────────────────────────────────────────────────────

Cypress.Commands.add('loginAs', (who: 'alice' | 'admin') => {
  const fixture = who === 'admin' ? 'session-admin.json' : 'session.json';
  cy.fixture(fixture).then((session) => {
    cy.window({ log: false }).then((win) => {
      win.localStorage.setItem('poopedex.session', JSON.stringify(session));
    });
  });
});

// ───── Géolocalisation ──────────────────────────────────────────────────────

const DEFAULT_COORDS = { lat: 48.8585, lng: 2.347, accuracy: 10 };

Cypress.Commands.add('mockGeolocation', (coords) => {
  beforeLoadState.geo = { ...DEFAULT_COORDS, ...coords };
});

// ───── Dialogues navigateur ─────────────────────────────────────────────────

Cypress.Commands.add('stubDialogs', (opts) => {
  beforeLoadState.dialogs = {
    confirm: opts?.confirm ?? true,
    prompt: opts?.promptValue ?? null,
  };
});

// ───── API stubs ────────────────────────────────────────────────────────────

/**
 * Stub TOUTES les routes API que le front sait appeler — en cohérence avec
 * `web/src/api/hooks.ts`. Les réponses pointent sur des fixtures JSON ; les
 * mutations renvoient un payload réaliste pour que React Query invalide les
 * caches comme en prod.
 */
Cypress.Commands.add('mockApi', () => {
  const api = (path: string) => `http://localhost:3000${path}`;

  // — Auth ————————————————————————————————————————————————————————
  cy.intercept('POST', api('/auth/login'), (req) => {
    if (req.body?.identifier === 'alice' && req.body?.password === 'good-pass') {
      req.reply({ statusCode: 200, fixture: 'session.json' });
    } else if (req.body?.identifier === 'admin' && req.body?.password === 'admin-pass') {
      req.reply({ statusCode: 200, fixture: 'session-admin.json' });
    } else {
      req.reply({
        statusCode: 401,
        body: { error: 'invalid_credentials', message: 'Identifiants invalides' },
      });
    }
  }).as('login');

  cy.intercept('POST', api('/auth/register'), (req) => {
    if (typeof req.body?.username === 'string' && req.body.username.length >= 3) {
      req.reply({ statusCode: 200, fixture: 'session.json' });
    } else {
      req.reply({
        statusCode: 400,
        body: { error: 'invalid_body', message: 'Pseudo trop court' },
      });
    }
  }).as('register');

  cy.intercept('POST', api('/auth/refresh'), { statusCode: 200, fixture: 'session.json' }).as(
    'refresh',
  );

  // Toutes les URL API sont ancrées sur le port 3000 : Cypress intercepte aussi
  // les URLs absolues du SPA (port 5173) si on utilise un simple regex sur le
  // path → on s'oblige à matcher l'origine API explicitement (glob `**`).

  // — Profil ——————————————————————————————————————————————————————
  cy.intercept('GET', api('/users/me'), { fixture: 'profile.json' }).as('me');
  cy.intercept('GET', api('/users/00000000-0000-0000-0000-00000000bbbb'), {
    fixture: 'profile-bob.json',
  }).as('userBob');

  // — Leaderboards ————————————————————————————————————————————————
  cy.intercept('GET', `${api('/toilets/leaderboard')}*`, {
    fixture: 'leaderboard-toilets.json',
  }).as('lbToilets');
  cy.intercept('GET', `${api('/users/leaderboard')}**scope=global*`, {
    fixture: 'leaderboard-users.json',
  }).as('lbUsersGlobal');
  cy.intercept('GET', `${api('/users/leaderboard')}**scope=friends*`, {
    fixture: 'leaderboard-users-friends.json',
  }).as('lbUsersFriends');

  // — Toilettes ———————————————————————————————————————————————————
  cy.intercept('GET', `${api('/toilets/bbox')}*`, { fixture: 'toilets-bbox.json' }).as(
    'toiletsBbox',
  );
  cy.intercept('GET', `${api('/toilets')}?*radius=*`, { fixture: 'toilets-bbox.json' }).as(
    'toiletsNearby',
  );
  cy.intercept('GET', api('/toilets/10000000-0000-0000-0000-000000000001'), {
    fixture: 'toilet-detail.json',
  }).as('toiletDetail');
  cy.intercept('POST', api('/toilets'), {
    statusCode: 200,
    body: { id: '10000000-0000-0000-0000-0000000000ff' },
  }).as('addToilet');
  cy.intercept('POST', `${api('/toilets')}/*/poops`, { fixture: 'checkin-result.json' }).as(
    'checkin',
  );

  // — Amis ————————————————————————————————————————————————————————
  cy.intercept('GET', api('/friends'), { fixture: 'friends.json' }).as('friends');
  cy.intercept('GET', api('/friends/requests'), { fixture: 'friend-requests.json' }).as(
    'friendReqs',
  );
  cy.intercept('GET', api('/friends/requests/sent'), { fixture: 'friend-requests-sent.json' }).as(
    'friendReqsSent',
  );
  cy.intercept('POST', api('/friends/requests'), {
    statusCode: 200,
    body: { status: 'pending' },
  }).as('sendFriendReq');
  cy.intercept('POST', `${api('/friends/requests')}/*/accept`, { statusCode: 204 }).as(
    'acceptFriend',
  );
  cy.intercept('POST', `${api('/friends/requests')}/*/decline`, { statusCode: 204 }).as(
    'declineFriend',
  );
  cy.intercept('DELETE', `${api('/friends')}/*`, { statusCode: 204 }).as('removeFriend');

  // — Admin ———————————————————————————————————————————————————————
  cy.intercept('GET', api('/admin/toilets'), { fixture: 'admin-toilets.json' }).as('adminToilets');
  cy.intercept('GET', api('/admin/users'), { fixture: 'admin-users.json' }).as('adminUsers');
  cy.intercept('DELETE', `${api('/admin/toilets')}/*`, { statusCode: 204 }).as('adminDeleteToilet');

  // — Style MapLibre minimal ——————————————————————————————————————
  cy.intercept('GET', '/__test/style.json', { fixture: 'map-style.json' }).as('mapStyle');
});

export {};
