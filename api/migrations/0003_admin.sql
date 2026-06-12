-- ============================================================
-- Poopedex — vue admin
--   * users.is_admin : flag de modération
--   * toilets.is_deleted : soft-delete admin (≠ status='removed'
--     qui restera réservé à un éventuel cycle de vie OSM)
--   * deleted_at / deleted_by : traçabilité
-- ============================================================

ALTER TABLE users
    ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE toilets
    ADD COLUMN is_deleted BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- L'index "actif" doit ignorer aussi les soft-deletes (les requêtes carte filtrent
-- déjà sur is_deleted = false, autant que l'index reflète ce critère).
DROP INDEX IF EXISTS idx_toilets_status;
CREATE INDEX idx_toilets_active
    ON toilets (status)
    WHERE status = 'active' AND is_deleted = false;
