// Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget) — adapté plateforme sensetho-apps2.
// Ne pas éditer sans reporter au Catalogue-App.
//
// Handlers serveur du module « Budget association » (comptabilité associative).
//
// Adaptations plateforme :
// - `getDb` = `createRouteClient()` d'apps2 (client SSR cookies) — plus de factory à câbler ;
// - la « structure » d'un exercice est une ORGANISATION : jointure
//   `organisations(id, raison_sociale:denomination)` (alias PostgREST — la
//   réponse conserve la forme `{ id, raison_sociale }` attendue par l'UI) ;
// - les actions vivent dans `budget_actions` (+ CRUD `actionsGET/POST/PATCH/DELETE`) ;
// - le rôle admin est lu dans `profiles.role` via le client service-role
//   (et non dans `user.user_metadata`) ;
// - Next.js 14 : `ctx.params` est synchrone (pas de Promise) ;
// - la corbeille (soft delete) d'un exercice est ouverte aux authentifiés — la
//   RLS multi-tenant (propriétaire d'organisation OU admin) fait autorité ;
//   listing corbeille, restauration et suppression définitive restent admin.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: { id: string } };

const AFFECTATIONS = ["fonctionnement", "action"];
const COMPTE_TYPES = ["charge", "produit"];
const NIVEAUX = ["lecture", "ecriture"];
const TYPES_PIECE = ["facture", "devis", "contrat", "autre"];

/** Jointure « structure » = organisation (alias PostgREST raison_sociale:denomination). */
const EXERCICE_SELECT = "*, structure:organisations(id, raison_sociale:denomination)";
const LIGNE_SELECT = "*, compte:budget_comptes(*), details:budget_lignes_details(*)";

async function getDb(): Promise<SupabaseClient> {
  return createRouteClient();
}

async function auth() {
  const db = await getDb();
  const { data: { user } } = await db.auth.getUser();
  return { db, user };
}

const unauth = () => NextResponse.json({ error: "Non authentifié" }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ error: "Accès refusé — réservé aux administrateurs" }, { status: 403 });

/** Rôle admin lu dans `profiles.role` (plateforme apps2) — PAS dans user_metadata. */
async function isAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return data?.role === "admin";
}

/** Recalcule les totaux d'une ligne depuis ses détails. */
async function recalcLigne(db: SupabaseClient, ligneId: string): Promise<void> {
  const { data } = await db
    .from("budget_lignes_details")
    .select("montant_previsionnel, montant_realise")
    .eq("ligne_id", ligneId);
  if (!data) return;
  const rows = data as { montant_previsionnel: number | null; montant_realise: number | null }[];
  const totalPrev = rows.reduce((s, d) => s + (Number(d.montant_previsionnel) || 0), 0);
  const totalReal = rows.reduce((s, d) => s + (Number(d.montant_realise) || 0), 0);
  await db
    .from("budget_lignes")
    .update({ montant_previsionnel: totalPrev, montant_realise: totalReal })
    .eq("id", ligneId);
}

// ── Exercices ──────────────────────────────────────────────

/** GET — liste des exercices (`?structure_id=` = organisation, `?trash=true` = corbeille, admin). */
export async function exercicesGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { searchParams } = req.nextUrl;
  const structureId = searchParams.get("structure_id");
  const trash = searchParams.get("trash") === "true";
  if (trash && !(await isAdmin(user))) return forbidden();

  let query = db
    .from("budget_exercices")
    .select(EXERCICE_SELECT)
    .order("date_debut", { ascending: false });
  query = trash ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (structureId) query = query.eq("structure_id", structureId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST — créer un exercice (RLS : propriétaire de l'organisation OU admin). */
export async function exercicesPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const { data, error } = await db
    .from("budget_exercices")
    .insert({ ...body, created_by: user.id, updated_by: user.id })
    .select(EXERCICE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** GET — un exercice + ses lignes (`?affectation=fonctionnement|action|all`, `?action_id=`). */
export async function exerciceGET(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const { searchParams } = req.nextUrl;
  const affectation = searchParams.get("affectation") ?? "fonctionnement";
  const actionId = searchParams.get("action_id");

  let lignesQ = db
    .from("budget_lignes")
    .select(LIGNE_SELECT)
    .eq("exercice_id", id)
    .order("created_at");
  if (affectation !== "all") {
    lignesQ = lignesQ.eq("affectation_type", affectation);
    if (affectation === "action" && actionId) lignesQ = lignesQ.eq("action_id", actionId);
  }

  const [{ data: exercice, error: e1 }, { data: lignes, error: e2 }] = await Promise.all([
    db.from("budget_exercices").select(EXERCICE_SELECT).eq("id", id).single(),
    lignesQ,
  ]);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 404 });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const lignesWithSortedDetails = (lignes ?? []).map((l) => ({
    ...l,
    details: [...(l.details ?? [])].sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));
  return NextResponse.json({ exercice, lignes: lignesWithSortedDetails });
}

/** PATCH — mise à jour d'un exercice ; `{ restore: true }` = sortie de corbeille (admin). */
export async function exercicePATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();

  if (body.restore === true) {
    if (!(await isAdmin(user))) return forbidden();
    const { data, error } = await db
      .from("budget_exercices")
      .update({ deleted_at: null, deleted_by: null, updated_by: user.id })
      .eq("id", id)
      .select(EXERCICE_SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await db
    .from("budget_exercices")
    .update({ ...body, updated_by: user.id })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/**
 * DELETE — corbeille (soft delete) par défaut, `?permanent=true` = définitif (admin).
 * Le soft delete est gouverné par la RLS (propriétaire d'organisation OU admin).
 */
export async function exerciceDELETE(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();

  if (req.nextUrl.searchParams.get("permanent") === "true") {
    if (!(await isAdmin(user))) return forbidden();
    const { error } = await db.from("budget_exercices").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, permanent: true });
  }
  const { error } = await db
    .from("budget_exercices")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, permanent: false });
}

/** GET — actions (budget_actions) ayant des lignes dans l'exercice + totaux prévisionnels/réalisés. */
export async function actionSubsGET(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();

  const [{ data: lignes, error }, { data: allComptes }] = await Promise.all([
    db
      .from("budget_lignes")
      .select("action_id, compte_id, montant_previsionnel, montant_realise, compte:budget_comptes(type)")
      .eq("exercice_id", id)
      .eq("affectation_type", "action")
      .not("action_id", "is", null),
    db.from("budget_comptes").select("id, parent_id"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Comptes « groupes » (ayant des enfants) : leurs lignes directes sont ignorées,
  // l'UI n'agrège que les feuilles.
  const groupIds = new Set<string>();
  for (const c of allComptes ?? []) if (c.parent_id) groupIds.add(c.parent_id);

  const byAction = new Map<
    string,
    { total_charges_prev: number; total_produits_prev: number; total_realise: number }
  >();
  for (const l of lignes ?? []) {
    if (!l.action_id || groupIds.has(l.compte_id)) continue;
    const cur =
      byAction.get(l.action_id) ??
      { total_charges_prev: 0, total_produits_prev: 0, total_realise: 0 };
    const ctype = (l.compte as unknown as { type: string } | null)?.type;
    if (ctype === "charge") cur.total_charges_prev += Number(l.montant_previsionnel) || 0;
    if (ctype === "produit") cur.total_produits_prev += Number(l.montant_previsionnel) || 0;
    cur.total_realise += Number(l.montant_realise) || 0;
    byAction.set(l.action_id, cur);
  }
  if (byAction.size === 0) return NextResponse.json([]);

  const { data: actions, error: e2 } = await db
    .from("budget_actions")
    .select("id, nom, statut, date_debut, date_fin")
    .in("id", Array.from(byAction.keys()));
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const result = (actions ?? []).map((a) => ({
    ...a,
    ...(byAction.get(a.id) ??
      { total_charges_prev: 0, total_produits_prev: 0, total_realise: 0 }),
  }));
  return NextResponse.json(result);
}

// ── Actions (table plateforme budget_actions) ──────────────

/** GET — actions (`?organisation_id=` pour filtrer), triées par nom. */
export async function actionsGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const orgId = req.nextUrl.searchParams.get("organisation_id");
  let query = db.from("budget_actions").select("*").order("nom");
  if (orgId) query = query.eq("organisation_id", orgId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST — créer une action `{ nom, organisation_id?, statut?, date_debut?, date_fin? }`. */
export async function actionsPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const b = await req.json();
  if (!b.nom?.trim()) return NextResponse.json({ error: "nom requis" }, { status: 400 });
  const { data, error } = await db
    .from("budget_actions")
    .insert({
      nom: b.nom.trim(),
      organisation_id: b.organisation_id ?? null,
      statut: b.statut ?? "en_cours",
      date_debut: b.date_debut ?? null,
      date_fin: b.date_fin ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH — mise à jour d'une action. */
export async function actionPATCH(req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const b = await req.json();
  const fields: Record<string, unknown> = {};
  if (b.nom !== undefined) fields.nom = String(b.nom).trim();
  if (b.organisation_id !== undefined) fields.organisation_id = b.organisation_id;
  if (b.statut !== undefined) fields.statut = b.statut;
  if (b.date_debut !== undefined) fields.date_debut = b.date_debut;
  if (b.date_fin !== undefined) fields.date_fin = b.date_fin;
  if (Object.keys(fields).length === 0)
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  const { data, error } = await db
    .from("budget_actions")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** DELETE — supprime une action (les lignes liées gardent action_id = null). */
export async function actionDELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const { error } = await db.from("budget_actions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

// ── Comptes (plan comptable) ───────────────────────────────

/** GET — plan comptable actif, trié par type puis sort_order. */
export async function comptesGET() {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { data, error } = await db
    .from("budget_comptes")
    .select("*")
    .eq("is_active", true)
    .order("type")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST — créer un compte (RLS : admin). Refuse les numéros en doublon (409). */
export async function comptesPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const { numero, libelle, type, parent_id, sort_order = 0 } = body;
  if (!numero || !libelle || !COMPTE_TYPES.includes(type))
    return NextResponse.json({ error: "numero, libelle et type sont requis" }, { status: 400 });

  const { data: existing } = await db
    .from("budget_comptes")
    .select("id")
    .eq("numero", numero)
    .maybeSingle();
  if (existing)
    return NextResponse.json(
      { error: `Le numéro de compte ${numero} existe déjà` },
      { status: 409 }
    );

  const { data, error } = await db
    .from("budget_comptes")
    .insert({ numero, libelle, type, parent_id: parent_id ?? null, sort_order, is_active: true })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

// ── Lignes budgétaires ─────────────────────────────────────

/**
 * POST — upsert d'une ligne (compte × sous-budget).
 * SELECT → UPDATE/INSERT (pas de `.upsert()` : les index uniques PARTIELS
 * ne sont pas supportés par le ON CONFLICT de PostgREST).
 */
export async function lignesPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const {
    exercice_id,
    compte_id,
    action_id = null,
    affectation_type = "fonctionnement",
    ...fields
  } = body;
  if (!exercice_id || !compte_id)
    return NextResponse.json({ error: "exercice_id et compte_id requis" }, { status: 400 });
  if (!AFFECTATIONS.includes(affectation_type))
    return NextResponse.json({ error: "affectation_type invalide" }, { status: 400 });

  let lookupQ = db
    .from("budget_lignes")
    .select("id")
    .eq("exercice_id", exercice_id)
    .eq("compte_id", compte_id)
    .eq("affectation_type", affectation_type);
  lookupQ =
    affectation_type === "action" && action_id
      ? lookupQ.eq("action_id", action_id)
      : lookupQ.is("action_id", null);
  const { data: existing } = await lookupQ.maybeSingle();

  let data: unknown, error: { message: string } | null;
  if (existing) {
    ({ data, error } = await db
      .from("budget_lignes")
      .update({ ...fields, updated_by: user.id })
      .eq("id", existing.id)
      .select(LIGNE_SELECT)
      .single());
  } else {
    ({ data, error } = await db
      .from("budget_lignes")
      .insert({ exercice_id, compte_id, affectation_type, action_id, ...fields, updated_by: user.id })
      .select(LIGNE_SELECT)
      .single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/**
 * PATCH — mise à jour d'une ligne `{ id, ...champs }` + journal d'audit optionnel :
 * si `champ` (+ `old_value`/`new_value`, `motif`) est fourni, une entrée
 * `budget_modifications` est enregistrée.
 */
export async function lignesPATCH(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const { id, motif, old_value, new_value, champ, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { data, error } = await db
    .from("budget_lignes")
    .update({ ...fields, updated_by: user.id })
    .eq("id", id)
    .select(LIGNE_SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (champ && (old_value !== undefined || new_value !== undefined)) {
    await db.from("budget_modifications").insert({
      ligne_id: id,
      champ,
      ancienne_valeur: old_value != null ? String(old_value) : null,
      nouvelle_valeur: new_value != null ? String(new_value) : null,
      motif: motif ?? null,
      modified_by: user.id,
    });
  }
  return NextResponse.json(data);
}

/** DELETE — supprime une ligne `{ id }` (cascade sur détails, modifs, pièces). */
export async function lignesDELETE(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await db.from("budget_lignes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** GET — journal d'audit d'une ligne (`?ligne_id=` requis). */
export async function modificationsGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const ligneId = req.nextUrl.searchParams.get("ligne_id");
  if (!ligneId) return NextResponse.json({ error: "ligne_id requis" }, { status: 400 });
  const { data, error } = await db
    .from("budget_modifications")
    .select("*")
    .eq("ligne_id", ligneId)
    .order("modified_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ── Détails de lignes ──────────────────────────────────────

/** POST — créer un détail, puis recalcul des totaux de la ligne. */
export async function lignesDetailsPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const {
    ligne_id,
    commentaire = "",
    montant_previsionnel = 0,
    montant_realise = 0,
    sort_order = 0,
  } = body;
  if (!ligne_id) return NextResponse.json({ error: "ligne_id requis" }, { status: 400 });

  const { data, error } = await db
    .from("budget_lignes_details")
    .insert({ ligne_id, commentaire, montant_previsionnel, montant_realise, sort_order })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await recalcLigne(db, ligne_id);
  return NextResponse.json(data);
}

/**
 * PATCH — trois modes :
 * - `{ reorder: [{ id, sort_order }] }` : réordonnancement batch ;
 * - `{ id, ligne_id, move_to_ligne_id }` : déplacement vers une autre ligne (recalc des deux) ;
 * - `{ id, ligne_id?, ...champs }` : mise à jour normale (+ recalc si `ligne_id` fourni).
 */
export async function lignesDetailsPATCH(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();

  if (Array.isArray(body.reorder)) {
    for (const item of body.reorder as { id: string; sort_order: number }[]) {
      await db
        .from("budget_lignes_details")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
    }
    return NextResponse.json({ ok: true });
  }

  const { id, ligne_id, move_to_ligne_id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  if (move_to_ligne_id) {
    const { data, error } = await db
      .from("budget_lignes_details")
      .update({ ligne_id: move_to_ligne_id })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (ligne_id) await recalcLigne(db, ligne_id); // recalc ligne source
    await recalcLigne(db, move_to_ligne_id); // recalc ligne cible
    return NextResponse.json(data);
  }

  const { data, error } = await db
    .from("budget_lignes_details")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (ligne_id) await recalcLigne(db, ligne_id);
  return NextResponse.json(data);
}

/** DELETE — supprime un détail `{ id, ligne_id? }` puis recalc. */
export async function lignesDetailsDELETE(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { id, ligne_id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const { error } = await db.from("budget_lignes_details").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (ligne_id) await recalcLigne(db, ligne_id);
  return NextResponse.json({ ok: true });
}

/**
 * POST — transfère un détail vers un autre sous-budget (fonctionnement ↔ action).
 * Crée la ligne cible (même compte) si elle n'existe pas, puis recalcule les deux lignes.
 */
export async function transfertDetailPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const {
    detail_id,
    from_ligne_id,
    exercice_id,
    compte_id,
    target_affectation_type,
    target_action_id = null,
  } = body as {
    detail_id: string;
    from_ligne_id: string;
    exercice_id: string;
    compte_id: string;
    target_affectation_type: "fonctionnement" | "action";
    target_action_id: string | null;
  };
  if (!detail_id || !from_ligne_id || !exercice_id || !compte_id || !target_affectation_type)
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  let lookupQ = db
    .from("budget_lignes")
    .select("id")
    .eq("exercice_id", exercice_id)
    .eq("compte_id", compte_id)
    .eq("affectation_type", target_affectation_type);
  lookupQ =
    target_affectation_type === "action" && target_action_id
      ? lookupQ.eq("action_id", target_action_id)
      : lookupQ.is("action_id", null);
  let { data: targetLigne } = await lookupQ.maybeSingle();

  if (!targetLigne) {
    const { data: newLigne, error: insertErr } = await db
      .from("budget_lignes")
      .insert({
        exercice_id,
        compte_id,
        affectation_type: target_affectation_type,
        action_id: target_action_id,
        montant_previsionnel: 0,
        montant_realise: 0,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });
    targetLigne = newLigne;
  }

  const { error: moveErr } = await db
    .from("budget_lignes_details")
    .update({ ligne_id: targetLigne.id })
    .eq("id", detail_id);
  if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 400 });

  await recalcLigne(db, from_ligne_id);
  await recalcLigne(db, targetLigne.id);
  return NextResponse.json({ ok: true, to_ligne_id: targetLigne.id });
}

/**
 * POST — import Excel en masse : `{ exercice_id, affectation_type, action_id, rows }`.
 * Regroupe les lignes par compte, crée les lignes manquantes, insère les détails
 * en bloc puis recalcule chaque ligne. Renvoie `{ imported, errors }`.
 */
export async function importExcelPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const body = await req.json();
  const { exercice_id, affectation_type, action_id, rows } = body as {
    exercice_id: string;
    affectation_type: "fonctionnement" | "action";
    action_id: string | null;
    rows: {
      compte_id: string;
      commentaire?: string;
      montant_previsionnel: number;
      montant_realise?: number;
    }[];
  };
  if (!exercice_id || !AFFECTATIONS.includes(affectation_type) || !Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const errors: { row: number; message: string }[] = [];
  let imported = 0;

  const byCompte = new Map<string, typeof rows>();
  rows.forEach((r, i) => {
    if (!r.compte_id) {
      errors.push({ row: i + 1, message: "compte_id manquant" });
      return;
    }
    if (!byCompte.has(r.compte_id)) byCompte.set(r.compte_id, []);
    byCompte.get(r.compte_id)!.push(r);
  });

  // Array.from : le target TS de la plateforme ne permet pas d'itérer un MapIterator.
  for (const [compteId, compteRows] of Array.from(byCompte.entries())) {
    // 1. Trouver ou créer la ligne pour ce compte dans ce sous-budget
    let lookupQ = db
      .from("budget_lignes")
      .select("id")
      .eq("exercice_id", exercice_id)
      .eq("compte_id", compteId)
      .eq("affectation_type", affectation_type);
    lookupQ = action_id ? lookupQ.eq("action_id", action_id) : lookupQ.is("action_id", null);
    const { data: existing } = await lookupQ.maybeSingle();

    let ligneId: string;
    if (existing?.id) {
      ligneId = existing.id;
    } else {
      const { data: created, error: createErr } = await db
        .from("budget_lignes")
        .insert({
          exercice_id,
          compte_id: compteId,
          affectation_type,
          action_id: action_id ?? null,
          montant_previsionnel: 0,
          montant_realise: 0,
          updated_by: user.id,
        })
        .select("id")
        .single();
      if (createErr || !created?.id) {
        compteRows.forEach((_, i) =>
          errors.push({ row: i, message: `Erreur création ligne : ${createErr?.message}` })
        );
        continue;
      }
      ligneId = created.id;
    }

    // 2. Insérer les détails en bloc
    const details = compteRows.map((r, i) => ({
      ligne_id: ligneId,
      commentaire: r.commentaire ?? "",
      montant_previsionnel: r.montant_previsionnel ?? 0,
      montant_realise: r.montant_realise ?? 0,
      sort_order: Date.now() + i,
    }));
    const { error: detailErr } = await db.from("budget_lignes_details").insert(details);
    if (detailErr) {
      compteRows.forEach((_, i) => errors.push({ row: i, message: detailErr.message }));
      continue;
    }

    // 3. Recalculer le total de la ligne
    await recalcLigne(db, ligneId);
    imported += compteRows.length;
  }
  return NextResponse.json({ imported, errors });
}

// ── Pièces justificatives (fichiers dans SharePoint) ───────

/** GET — pièces d'une ligne (`?ligne_id=`) ou d'un détail (`?detail_id=`). */
export async function piecesGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { searchParams } = req.nextUrl;
  const ligneId = searchParams.get("ligne_id");
  const detailId = searchParams.get("detail_id");
  if (!ligneId && !detailId)
    return NextResponse.json({ error: "ligne_id ou detail_id requis" }, { status: 400 });

  let query = db.from("budget_pieces").select("*").order("created_at", { ascending: false });
  if (ligneId) query = query.eq("ligne_id", ligneId);
  if (detailId) query = query.eq("detail_id", detailId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST — référencer une pièce. Le FICHIER est uploadé au préalable vers
 * SharePoint (module `sharepoint` : ensure-folder → upload-session → PUT) ;
 * on ne stocke ici que `sharepoint_item_id` / `url` + métadonnées.
 */
export async function piecesPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const b = await req.json();
  if (!b.nom?.trim()) return NextResponse.json({ error: "nom requis" }, { status: 400 });
  if (!b.ligne_id && !b.detail_id)
    return NextResponse.json({ error: "ligne_id ou detail_id requis" }, { status: 400 });

  const { data, error } = await db
    .from("budget_pieces")
    .insert({
      ligne_id: b.ligne_id ?? null,
      detail_id: b.detail_id ?? null,
      nom: b.nom.trim(),
      sharepoint_item_id: b.sharepoint_item_id ?? null,
      url: b.url?.trim() || null,
      type_piece: TYPES_PIECE.includes(b.type_piece) ? b.type_piece : null,
      montant: typeof b.montant === "number" ? b.montant : null,
      date_piece: b.date_piece ?? null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE — supprime la référence (le fichier SharePoint est supprimé à part). */
export async function pieceDELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const { error } = await db.from("budget_pieces").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

// ── Reports de provisions ──────────────────────────────────

/** GET — reports (`?from_exercice_id=` et/ou `?to_exercice_id=`). */
export async function reportsGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { searchParams } = req.nextUrl;
  let query = db.from("budget_reports").select("*").order("created_at", { ascending: false });
  const fromId = searchParams.get("from_exercice_id");
  const toId = searchParams.get("to_exercice_id");
  if (fromId) query = query.eq("from_exercice_id", fromId);
  if (toId) query = query.eq("to_exercice_id", toId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST — reporter un solde non consommé d'un sous-budget vers un exercice. */
export async function reportsPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const b = await req.json();
  if (!b.from_exercice_id)
    return NextResponse.json({ error: "from_exercice_id requis" }, { status: 400 });
  if (!AFFECTATIONS.includes(b.affectation_type))
    return NextResponse.json({ error: "affectation_type invalide" }, { status: 400 });
  if (typeof b.montant !== "number")
    return NextResponse.json({ error: "montant invalide" }, { status: 400 });

  const { data, error } = await db
    .from("budget_reports")
    .insert({
      from_exercice_id: b.from_exercice_id,
      to_exercice_id: b.to_exercice_id ?? null,
      affectation_type: b.affectation_type,
      action_id: b.action_id ?? null,
      montant: b.montant,
      notes: b.notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE — annule un report. */
export async function reportDELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  const { error } = await db.from("budget_reports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}

// ── Permissions fines (gérées côté application) ────────────

/** GET — permissions (`?exercice_id=`, `?user_id=`). */
export async function permissionsGET(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  const { searchParams } = req.nextUrl;
  let query = db.from("budget_permissions").select("*").order("created_at");
  const exerciceId = searchParams.get("exercice_id");
  const userId = searchParams.get("user_id");
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * POST — accorder/modifier une permission (admin uniquement).
 * Upsert manuel sur (user_id, exercice_id, compte_type) — les colonnes
 * nullables rendent le ON CONFLICT PostgREST inopérant (NULL != NULL).
 */
export async function permissionsPOST(req: NextRequest) {
  const { db, user } = await auth();
  if (!user) return unauth();
  if (!(await isAdmin(user))) return forbidden();
  const b = await req.json();
  if (!b.user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  if (!NIVEAUX.includes(b.niveau))
    return NextResponse.json({ error: "niveau invalide (lecture|ecriture)" }, { status: 400 });
  const compteType = COMPTE_TYPES.includes(b.compte_type) ? b.compte_type : null;
  const exerciceId = b.exercice_id ?? null;

  let lookupQ = db.from("budget_permissions").select("id").eq("user_id", b.user_id);
  lookupQ = exerciceId ? lookupQ.eq("exercice_id", exerciceId) : lookupQ.is("exercice_id", null);
  lookupQ = compteType ? lookupQ.eq("compte_type", compteType) : lookupQ.is("compte_type", null);
  const { data: existing } = await lookupQ.maybeSingle();

  let data: unknown, error: { message: string } | null;
  if (existing) {
    ({ data, error } = await db
      .from("budget_permissions")
      .update({ niveau: b.niveau })
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await db
      .from("budget_permissions")
      .insert({ user_id: b.user_id, exercice_id: exerciceId, compte_type: compteType, niveau: b.niveau })
      .select()
      .single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE — révoquer une permission (admin uniquement). */
export async function permissionDELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = ctx.params;
  const { db, user } = await auth();
  if (!user) return unauth();
  if (!(await isAdmin(user))) return forbidden();
  const { error } = await db.from("budget_permissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
