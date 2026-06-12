-- ============================================================
-- Seed des badges liés au score de rareté.
--   * single_poop_score : best rarity_score sur un seul poop
--   * total_points      : somme des rarity_score
-- ============================================================
INSERT INTO badges (id, code, name, description, icon, criteria) VALUES
  (gen_random_uuid(), 'pioneer',     'Pionnier',              'Premier à découvrir une toilette (100 pts sur un poop).', '🥇', '{"type":"single_poop_score","gte":100}'),
  (gen_random_uuid(), 'score_1k',    'Mille bornes',          '1 000 points de rareté cumulés.',                          '🥉', '{"type":"total_points","gte":1000}'),
  (gen_random_uuid(), 'score_10k',   'Pro du trône',          '10 000 points de rareté cumulés.',                         '🥈', '{"type":"total_points","gte":10000}'),
  (gen_random_uuid(), 'score_100k',  'Légende des chiottes',  '100 000 points de rareté cumulés.',                        '🏆', '{"type":"total_points","gte":100000}'),
  (gen_random_uuid(), 'score_1m',    'Empereur du poop',      '1 000 000 points de rareté cumulés.',                      '👑', '{"type":"total_points","gte":1000000}')
ON CONFLICT (code) DO NOTHING;
