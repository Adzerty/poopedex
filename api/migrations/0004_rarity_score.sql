-- ============================================================
-- Poopedex — score de rareté par poop
--   Le score est figé au moment du check-in : 100 / (1 + poops_count_before),
--   plancher à 1. Plus une toilette est rare au moment où tu pooes, plus
--   ça rapporte. La formule vit dans packages/shared/scoring.ts.
--   Les poops existants sont backfillés au max (100) — on ne peut pas
--   reconstituer l'ordre exact de découverte historique.
-- ============================================================

ALTER TABLE poops
    ADD COLUMN rarity_score INTEGER;

UPDATE poops SET rarity_score = 100 WHERE rarity_score IS NULL;

ALTER TABLE poops
    ALTER COLUMN rarity_score SET NOT NULL,
    ADD CONSTRAINT chk_poops_rarity CHECK (rarity_score BETWEEN 1 AND 100);
