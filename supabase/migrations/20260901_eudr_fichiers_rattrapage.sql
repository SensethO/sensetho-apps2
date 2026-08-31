-- Rattrapage : renseigne base_name / version_num pour les fichiers déposés AVANT
-- le versionnage (2026-09-01). Ces fichiers gardent leur nom — on ne renomme pas
-- l'existant, ce serait précisément l'acte que la règle interdit — mais leur
-- rattachement à une lignée devient un fait consigné plutôt qu'un calcul refait
-- à chaque lecture.
--
-- Règles de dérivation, identiques à `baseDe()` dans src/lib/eudr/fichiers.ts :
--   1. retirer l'extension ;
--   2. retirer un suffixe « __vNNN » déjà présent ;
--   3. retirer l'ancien suffixe « (corrigé) », pour que l'original et sa
--      correction partagent la même base et donc la même lignée de versions.
--
-- `version_num` n'est renseigné que s'il est lisible dans le nom : un fichier
-- ancien sans suffixe reste à null et compte pour la version 1 côté application.
-- Lui attribuer d'office un numéro serait inventer une information.
update public.eudr_attachments
set
  base_name = nullif(trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(name, '\.[^.]*$', ''),      -- extension
        '__v[0-9]{3,}$', ''),                       -- suffixe de version
      '\s*\(corrigé\)\s*$', '', 'i')                -- ancien suffixe de correction
  ), ''),
  version_num = coalesce(
    version_num,
    nullif(substring(regexp_replace(name, '\.[^.]*$', '') from '__v([0-9]{3,})$'), '')::integer
  )
where base_name is null and name is not null;

-- ROLLBACK :
-- update public.eudr_attachments set base_name = null, version_num = null
--   where name !~ '__v[0-9]{3,}';
