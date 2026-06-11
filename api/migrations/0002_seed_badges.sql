-- ============================================================
-- Seed des badges initiaux.
-- criteria : règle déclarative évaluée dans modules/badges/service.ts
-- ============================================================
INSERT INTO badges (id, code, name, description, icon, criteria) VALUES
  (gen_random_uuid(), 'first_poop',    'Premier dépôt',  'Ton tout premier poop enregistré.',        '💩', '{"type":"total_poops","gte":1}'),
  (gen_random_uuid(), 'explorer_10',   'Explorateur',    '10 toilettes différentes découvertes.',     '🗺️', '{"type":"distinct_toilets","gte":10}'),
  (gen_random_uuid(), 'explorer_50',   'Grand voyageur', '50 toilettes différentes découvertes.',     '🌍', '{"type":"distinct_toilets","gte":50}'),
  (gen_random_uuid(), 'rater_10',      'Critique',       '10 toilettes notées pour la communauté.',   '⭐', '{"type":"total_ratings","gte":10}'),
  (gen_random_uuid(), 'regular_25',    'Habitué',        '25 poops au total. Bravo, ça coule.',       '🏆', '{"type":"total_poops","gte":25}')
ON CONFLICT (code) DO NOTHING;
