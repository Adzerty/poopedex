-- ============================================================
-- Poopedex — schéma initial
-- PostgreSQL 16+ / PostGIS
-- ============================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;     -- email/username insensibles à la casse
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid (fallback)

-- ---------- Enums ----------
CREATE TYPE toilet_source     AS ENUM ('osm', 'user');
CREATE TYPE toilet_status     AS ENUM ('active', 'out_of_service', 'removed');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY,
    username      CITEXT NOT NULL UNIQUE,
    email         CITEXT NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,            -- argon2id
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Toilets — référentiel (OSM + contributions users)
-- ============================================================
CREATE TABLE toilets (
    id          UUID PRIMARY KEY,
    source      toilet_source  NOT NULL,
    status      toilet_status  NOT NULL DEFAULT 'active',

    -- Liaison OSM (NULL si créée par un user)
    osm_type    CHAR(1),                       -- 'n','w','r' (node/way/relation)
    osm_id      BIGINT,

    location    GEOGRAPHY(Point, 4326) NOT NULL,
    name        TEXT,

    -- Attributs "durables" issus d'OSM (faits, pas d'opinions)
    access          TEXT,                      -- yes / customers / private...
    fee             BOOLEAN,                   -- payant ?
    wheelchair      BOOLEAN,                   -- accessible PMR
    unisex          BOOLEAN,
    changing_table  BOOLEAN,                   -- table à langer
    raw_tags        JSONB NOT NULL DEFAULT '{}',

    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Agrégats dénormalisés (maintenus par triggers)
    poops_count        INTEGER NOT NULL DEFAULT 0,
    ratings_count      INTEGER NOT NULL DEFAULT 0,
    avg_cleanliness    REAL,
    avg_safety         REAL,
    avg_hygiene        REAL,
    avg_inclusivity    REAL,
    avg_overall        REAL,
    last_rated_at      TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_toilets_osm UNIQUE (osm_type, osm_id)
);

CREATE INDEX idx_toilets_location ON toilets USING GIST (location);
CREATE INDEX idx_toilets_status   ON toilets (status) WHERE status = 'active';

-- ============================================================
-- Poops — check-ins ("j'ai utilisé cette toilette")
-- user_id devient NULL si le compte est supprimé (anonymisation RGPD)
-- ============================================================
CREATE TABLE poops (
    id           UUID PRIMARY KEY,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    toilet_id    UUID NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,

    -- Position réelle de l'user au check-in + précision GPS annoncée.
    -- Sert à la validation serveur ET à l'audit anti-triche.
    checkin_loc      GEOGRAPHY(Point, 4326) NOT NULL,
    checkin_accuracy REAL,                      -- mètres (API navigateur)
    distance_m       REAL,                      -- distance toilet<->user au check-in

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poops_user        ON poops (user_id, created_at DESC);
CREATE INDEX idx_poops_toilet      ON poops (toilet_id);
CREATE INDEX idx_poops_user_toilet ON poops (user_id, toilet_id);

-- ============================================================
-- Ratings — 1 note par poop (observation à l'instant T)
-- Survit à l'anonymisation : reste attachée au poop / à la toilette.
-- ============================================================
CREATE TABLE ratings (
    id        UUID PRIMARY KEY,
    poop_id   UUID NOT NULL UNIQUE REFERENCES poops(id) ON DELETE CASCADE,
    toilet_id UUID NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,

    -- Axes subjectifs (1..5)
    cleanliness SMALLINT NOT NULL CHECK (cleanliness BETWEEN 1 AND 5),
    safety      SMALLINT NOT NULL CHECK (safety      BETWEEN 1 AND 5),

    -- Axe HYGIÈNE : flags factuels
    has_soap          BOOLEAN NOT NULL DEFAULT false,
    has_toilet_paper  BOOLEAN NOT NULL DEFAULT false,
    has_bin           BOOLEAN NOT NULL DEFAULT false,

    -- Axe INCLUSIVITÉ : flags factuels
    has_menstrual_products BOOLEAN NOT NULL DEFAULT false,
    has_baby_changing      BOOLEAN NOT NULL DEFAULT false,

    -- Scores 0..5 dérivés (calculés côté API, cf. packages/shared/scoring.ts)
    hygiene_score     REAL NOT NULL CHECK (hygiene_score     BETWEEN 0 AND 5),
    inclusivity_score REAL NOT NULL CHECK (inclusivity_score BETWEEN 0 AND 5),
    overall_score     REAL NOT NULL CHECK (overall_score     BETWEEN 0 AND 5),

    comment   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ratings_toilet ON ratings (toilet_id, created_at DESC);

-- ============================================================
-- Badges
-- ============================================================
CREATE TABLE badges (
    id          UUID PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,          -- 'first_poop', 'explorer_10'...
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    icon        TEXT,
    criteria    JSONB NOT NULL,                -- règle déclarative d'attribution
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
    user_id     UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

-- ============================================================
-- Friendships (relation sociale, sans doublon A/B vs B/A)
-- ============================================================
CREATE TABLE friendships (
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       friendship_status NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, addressee_id),
    CONSTRAINT chk_no_self_friend CHECK (requester_id <> addressee_id)
);
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);

-- ============================================================
-- Ingestion OSM — cache des zones déjà importées, par tuile (z14)
-- ============================================================
CREATE TABLE osm_ingest_tiles (
    z            SMALLINT NOT NULL,
    x            INTEGER  NOT NULL,
    y            INTEGER  NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    toilet_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (z, x, y)
);

-- ============================================================
-- Triggers d'agrégation
-- ============================================================

-- poops_count++
CREATE FUNCTION trg_poops_count() RETURNS TRIGGER AS $$
BEGIN
    UPDATE toilets SET poops_count = poops_count + 1, updated_at = now()
    WHERE id = NEW.toilet_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER poops_after_insert AFTER INSERT ON poops
    FOR EACH ROW EXECUTE FUNCTION trg_poops_count();

-- Recalcule les moyennes de la toilette notée
CREATE FUNCTION trg_ratings_aggregate() RETURNS TRIGGER AS $$
BEGIN
    UPDATE toilets t SET
        ratings_count   = sub.cnt,
        avg_cleanliness = sub.cleanliness,
        avg_safety      = sub.safety,
        avg_hygiene     = sub.hygiene,
        avg_inclusivity = sub.inclusivity,
        avg_overall     = sub.overall,
        last_rated_at   = now(),
        updated_at      = now()
    FROM (
        SELECT count(*)               AS cnt,
               avg(cleanliness)       AS cleanliness,
               avg(safety)            AS safety,
               avg(hygiene_score)     AS hygiene,
               avg(inclusivity_score) AS inclusivity,
               avg(overall_score)     AS overall
        FROM ratings WHERE toilet_id = NEW.toilet_id
    ) sub
    WHERE t.id = NEW.toilet_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER ratings_after_insert AFTER INSERT ON ratings
    FOR EACH ROW EXECUTE FUNCTION trg_ratings_aggregate();
