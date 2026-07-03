-- Stratégie Partagée — matrices de croisement (remplies depuis les réponses) :
--   tows       : matrice de confrontation SWOT (FO/FA/WO/WA)
--   matrices   : { visionAxes: {partie:{axeId:score}}, attentesOffre: {attenteSlug:{produitSlug:score}} }
--   deploiement: { actions:[{id,libelle}], scores:{laId:{actionId:score}} }  (QUOI/COMMENT, corrélation 3/2/1)
alter table strategie_partagee
  add column if not exists tows        jsonb not null default '{}'::jsonb,
  add column if not exists matrices    jsonb not null default '{}'::jsonb,
  add column if not exists deploiement jsonb not null default '{}'::jsonb;
