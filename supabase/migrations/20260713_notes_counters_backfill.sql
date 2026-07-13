-- Rattrapage de traçabilité : fonctions compteur d'annexes créées en live
-- (API Supabase) mais jamais commitées dans le dépôt.
-- Définitions extraites de la base de production le 2026-07-13 (pg_get_functiondef).
-- Idempotent : CREATE OR REPLACE, aucune donnée modifiée.
-- Voir docs/RSE_APP_PATTERN.md §11 (compteur A001_ atomique, jamais réinitialisé).

CREATE OR REPLACE FUNCTION public.increment_act_carbone_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  UPDATE act_carbone_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter;
$function$;

CREATE OR REPLACE FUNCTION public.increment_afaq26000_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$  UPDATE afaq26000_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter;$function$;

CREATE OR REPLACE FUNCTION public.increment_afnor_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.afnor_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_attachment_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.guided_diagnostics SET attachment_counter = attachment_counter + 1 WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_bcorp_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE bcorp_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_bilan_ges_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE bilan_ges_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_ecovadis_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.ecovadis_diagnostics SET attachment_counter_notes = attachment_counter_notes + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter_notes; $function$;

CREATE OR REPLACE FUNCTION public.increment_eudr_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.eudr_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_gpsr_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE gpsr_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_gt_time_entry_notes_counter(p_entry_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE v_counter int; BEGIN INSERT INTO public.gt_time_entry_notes(entry_id, attachment_counter) VALUES (p_entry_id, 1) ON CONFLICT (entry_id) DO UPDATE SET attachment_counter = gt_time_entry_notes.attachment_counter + 1 RETURNING attachment_counter INTO v_counter; RETURN v_counter; END; $function$;

CREATE OR REPLACE FUNCTION public.increment_iso26000_attachment_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE public.iso26000_diagnostics SET attachment_counter = attachment_counter + 1 WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_iso45001_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE iso45001_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_iso50001_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE iso50001_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_label_nr_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
AS $function$ UPDATE label_nr_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_vigilance_notes_counter(p_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.vigilance_diagnostics SET attachment_counter = attachment_counter + 1, updated_at = NOW() WHERE id = p_id RETURNING attachment_counter; $function$;

CREATE OR REPLACE FUNCTION public.increment_vsme_attachment_counter(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_counter integer;
BEGIN
  UPDATE public.vsme_settings SET attachment_counter = attachment_counter + 1 WHERE id = p_id RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END; $function$;
