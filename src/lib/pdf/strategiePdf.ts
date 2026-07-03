/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export PDF de la stratégie partagée (Hoshin Kanri).
 * Moteur texte basé sur jsPDF (import dynamique) — rendu net, sélectionnable,
 * pagination automatique. Couvre les 13 modules de la méthode.
 */

const INDIGO: [number, number, number] = [79, 70, 229]
const DARK: [number, number, number] = [17, 24, 39]
const GRAY: [number, number, number] = [107, 114, 128]

const t = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v))
const slug = (s: any) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || '_'
const grid = (v: number) => (v ? String(v) : '·')

export async function exportStrategiePdf(doc: any, orgName: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })

  const L = 15, R = 15, W = 210 - L - R, TOP = 18, BOTTOM = 282
  let y = TOP

  const space = (h: number) => { if (y + h > BOTTOM) { pdf.addPage(); y = TOP } }
  const text = (s: string, x: number, size = 10, style: 'normal' | 'bold' | 'italic' = 'normal', color = DARK, maxW = W) => {
    pdf.setFont('helvetica', style); pdf.setFontSize(size); pdf.setTextColor(color[0], color[1], color[2])
    const lines = pdf.splitTextToSize(s, maxW)
    for (const ln of lines) { space(size * 0.42 + 1); pdf.text(ln, x, y); y += size * 0.42 + 1.2 }
  }
  const heading = (label: string) => {
    space(12); y += 2
    pdf.setFillColor(INDIGO[0], INDIGO[1], INDIGO[2]); pdf.rect(L, y - 4, W, 7, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(255, 255, 255)
    pdf.text(label, L + 2, y + 1); y += 7
  }
  const sub = (label: string) => { space(7); y += 1; text(label, L, 10.5, 'bold', INDIGO) }
  const para = (s: string, indent = 0) => text(s, L + indent, 10, 'normal', DARK, W - indent)
  const muted = (s: string) => text(s, L, 9, 'italic', GRAY)
  const kv = (k: string, v: any) => { space(6); text(`${k} : `, L, 10, 'bold'); y -= 5.4; text(t(v), L + Math.min(pdf.getTextWidth(`${k} : `) + 1, 60), 10, 'normal', DARK, W - 60) }
  const bullets = (items: string[]) => { (items ?? []).filter(Boolean).forEach(it => { space(6); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(INDIGO[0], INDIGO[1], INDIGO[2]); pdf.text('•', L + 1, y); pdf.setTextColor(DARK[0], DARK[1], DARK[2]); const lines = pdf.splitTextToSize(it, W - 6); pdf.text(lines, L + 5, y); y += lines.length * 4.4 + 1 }) }

  // ── Couverture ──
  pdf.setFillColor(INDIGO[0], INDIGO[1], INDIGO[2]); pdf.rect(0, 0, 210, 55, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22); pdf.setTextColor(255, 255, 255)
  pdf.text('Stratégie Partagée', L, 26); pdf.setFontSize(13); pdf.setFont('helvetica', 'normal'); pdf.text('Hoshin Kanri', L, 35)
  pdf.setFontSize(12); pdf.text(t(orgName), L, 47)
  y = 68
  if (doc.horizon) kv('Horizon', doc.horizon)
  try { muted(`Généré le ${new Date().toLocaleDateString('fr-FR')}`) } catch { /* noop */ }

  // ── Mission ──
  heading('1 · Mission — raison d’être')
  para(t(doc.mission?.raisonEtre))
  const critLabels: [string, string][] = [['clients', 'Centrée sur la satisfaction des besoins clients/PP'], ['metier', 'Basée sur le cœur de métier'], ['engagement', 'Motive et inspire l’engagement'], ['claire', 'Réaliste, claire, facile à comprendre'], ['memorable', 'Spécifique, courte, mémorable'], ['coherente', 'Cohérente avec la vision']]
  y += 1; sub('Critères de validation')
  critLabels.forEach(([k, lab]) => text(`${doc.mission?.criteres?.[k] ? '☑' : '☐'} ${lab}`, L + 1, 10))

  // ── SWOT ──
  heading('2 · Analyse SWOT')
  const sw = doc.swot ?? {}
  sub('Forces (interne +)'); bullets(sw.forces)
  sub('Faiblesses (interne −)'); bullets(sw.faiblesses)
  sub('Opportunités (externe +)'); bullets(sw.opportunites)
  sub('Menaces (externe −)'); bullets(sw.menaces)

  // ── Attentes clients ──
  heading('3 · Attentes clients (Kano)')
  const at = doc.attentes ?? {}
  sub('Base (obligatoire)'); bullets(at.base)
  sub('Proportionnel (performance)'); bullets(at.proportionnel)
  sub('Attractif (séduction)'); bullets(at.attractif)
  sub('Avantages compétitifs'); bullets(at.avantages)
  if (at.nps) kv('NPS', at.nps)

  // ── Vision ──
  heading('4 · Vision')
  const v = doc.vision ?? {}
  kv('Synthétique', v.synthetique)
  if (v.detaillee) { sub('Détaillée'); para(v.detaillee) }
  if (v.chiffree) { sub('Éléments chiffrés'); para(v.chiffree) }
  sub('4 parties prenantes')
  kv('Hommes', v.parties?.hommes); kv('Marché / Clients', v.parties?.marche); kv('Environnement', v.parties?.environnement); kv('Entreprise / Actionnaires', v.parties?.entreprise)
  sub('Questions structurantes')
  const qs: [string, any][] = [['Entreprise', v.questions?.entreprise], ['Clients', v.questions?.clients], ['Marché', v.questions?.marche], ['Personnel', v.questions?.personnel], ['Fonctionnement', v.questions?.fonctionnement]]
  qs.forEach(([k, val]) => { if (val) { text(k, L, 9.5, 'bold', GRAY); para(String(val), 2) } })

  // ── Valeurs ──
  heading('5 · Valeurs & règles du jeu')
  const vc = doc.valeurs_collecte ?? {}
  if ((vc.aujourdhui?.length || vc.mieux?.length || vc.projet?.length)) {
    sub('Récolte des valeurs (3 questions)')
    if (vc.aujourdhui?.length) { text('Partagées aujourd’hui :', L, 9.5, 'bold', GRAY); bullets(vc.aujourdhui) }
    if (vc.mieux?.length) { text('À mieux partager :', L, 9.5, 'bold', GRAY); bullets(vc.mieux) }
    if (vc.projet?.length) { text('Pour réussir le projet :', L, 9.5, 'bold', GRAY); bullets(vc.projet) }
  }
  ;(doc.valeurs ?? []).forEach((val: any) => { sub(t(val.valeur)); bullets(val.regles) })

  // ── Axes & Lignes d'actions ──
  heading('6 · Axes stratégiques & Lignes d’actions')
  ;(doc.axes ?? []).forEach((axe: any, ai: number) => {
    sub(`A${ai + 1} · ${t(axe.titre)}`)
    if (axe.indicateur || axe.objectif) text(`Indicateur de l’axe : ${t(axe.indicateur)}   ·   Objectif : ${t(axe.objectif)}`, L + 1, 9, 'italic', GRAY)
    if (axe.freins?.length) { text('Freins & obstacles :', L, 9.5, 'bold', GRAY); bullets(axe.freins) }
    ;(axe.lignes ?? []).forEach((la: any, li: number) => {
      text(`LA${ai + 1}.${li + 1} — ${t(la.enonce)}`, L + 1, 10, 'bold')
      if (la.objectif) para(`Résultat : ${la.objectif}`, 3)
      const meta = [la.indicateur && `Indicateur : ${la.indicateur}`, (la.niveauActuel || la.cible) && `${t(la.niveauActuel)} → ${t(la.cible)}`, la.echeance && `Échéance : ${la.echeance}`, `Déployable : ${la.deployable ? 'Oui' : 'Non'}`].filter(Boolean).join('   ·   ')
      if (meta) text(meta, L + 3, 9, 'italic', GRAY)
      y += 1
    })
  })

  // ── Matrice Hoshin ──
  heading('7 · Matrice Hoshin d’alignement')
  muted('Contribution de chaque ligne d’action aux axes : 3 fort · 2 moyen · 1 faible.')
  const axes = doc.axes ?? []; const scores = doc.hoshin?.scores ?? {}; const sponsors = doc.hoshin?.sponsors ?? {}
  axes.forEach((axe: any, ai: number) => (axe.lignes ?? []).forEach((la: any, li: number) => {
    const contribs = axes.map((a: any, aj: number) => { const val = scores[la.id]?.[a.id] ?? 0; return val ? `A${aj + 1}:${val}` : null }).filter(Boolean)
    const total = axes.reduce((s: number, a: any) => s + (scores[la.id]?.[a.id] ?? 0), 0)
    text(`LA${ai + 1}.${li + 1} — ${t(la.enonce)}`, L + 1, 9.5, 'bold')
    const line = [contribs.length ? contribs.join(', ') : 'aucune contribution', `Total : ${total}`, sponsors[la.id] && `Sponsor : ${sponsors[la.id]}`].filter(Boolean).join('   ·   ')
    text(line, L + 3, 9, 'italic', GRAY)
  }))

  // ── Balanced Scorecard ──
  heading('8 · Balanced Scorecard')
  const bscLab: [string, string][] = [['finances', 'Résultats financiers'], ['clients', 'Résultats clients'], ['processus', 'Processus internes'], ['apprentissage', 'Apprentissage organisationnel']]
  bscLab.forEach(([k, lab]) => { const items = doc.bsc?.[k] ?? []; if (items.length) { sub(lab); items.forEach((it: any) => text(`• [${it.type === 'A' ? 'A' : 'P'}] ${t(it.objectif)}  —  ${t(it.indicateur)}  →  ${t(it.cible)}`, L + 1, 9.5)) } })
  const allBsc = bscLab.flatMap(([k]) => doc.bsc?.[k] ?? [])
  if (allBsc.length) {
    const nbA = allBsc.filter((i: any) => i.type === 'A').length
    muted(`Équilibrage : ${allBsc.length} indicateurs (cible 15-25) · ${Math.round((nbA / allBsc.length) * 100)} % en avance (cible ~33 %) · A = en Avance, P = a Posteriori.`)
  }

  // ── Master Plan ──
  heading('9 · Master Plan')
  const pilLab: Record<string, string> = { hierarchique: 'Hiérarchique', transversal: 'Transversal', projet: 'Projet' }
  ;(doc.master_plan ?? []).forEach((m: any) => {
    text(`${m.type === 'projet' ? '▣' : '▸'} ${t(m.libelle)}`, L + 1, 10, 'bold')
    text([`${m.type === 'projet' ? 'Projet' : 'Action'} · ${pilLab[m.pilotage] ?? '—'}`, m.responsable && `Qui : ${m.responsable}`, m.perimetre && `Où : ${m.perimetre}`, m.echeance && `Quand : ${m.echeance}`].filter(Boolean).join('   ·   '), L + 3, 9, 'italic', GRAY)
    const l2 = [m.ressources && `Combien : ${m.ressources}`, m.pourquoi && `Pourquoi : ${m.pourquoi}`, m.livrables && `Livrables : ${m.livrables}`].filter(Boolean).join('   ·   ')
    if (l2) text(l2, L + 3, 9, 'normal', GRAY)
  })

  // ── Tableau de bord ──
  heading('10 · Tableau de bord (PDCA)')
  const suivi = doc.pilotage?.suivi ?? {}; const feuLab: Record<string, string> = { vert: '● En bonne voie', orange: '● À surveiller', rouge: '● En retard' }
  axes.forEach((axe: any, ai: number) => (axe.lignes ?? []).forEach((la: any, li: number) => {
    if (!la.indicateur && !la.objectif) return
    const s = suivi[`la:${la.id}`] ?? {}
    text(`A${ai + 1}.${li + 1} · ${t(la.indicateur || la.objectif)}`, L + 1, 9.5, 'bold')
    text([`${t(la.niveauActuel)} → cible ${t(la.cible)}`, `actuel : ${t(s.valeur)}`, feuLab[s.statut] ?? '—'].join('   ·   '), L + 3, 9, 'italic', GRAY)
  }))
  const revues = doc.pilotage?.revues ?? []
  const revLab: Record<string, string> = { unite: 'Suivi master plan (unité)', codir: 'Revue Codir', audit: 'Audit du président', reactualisation: 'Réactualisation annuelle' }
  if (revues.length) { sub('Revues de stratégie'); revues.forEach((r: any) => { text(`${t(r.date)} — ${revLab[r.type] ?? 'Revue'}`, L + 1, 9.5, 'bold'); para(t(r.note), 3) }) }

  // ── Kotter ──
  heading('11 · Conduite du changement (Kotter)')
  const kLabels = ['Créer un sentiment d’urgence', 'Former une coalition puissante', 'Développer une vision mobilisatrice', 'Communiquer la vision', 'Lever les obstacles au changement', 'Démontrer des résultats à court terme', 'Bâtir sur les premiers résultats', 'Ancrer les nouvelles pratiques']
  const statLab: Record<string, string> = { afaire: 'À faire', encours: 'En cours', fait: 'Fait' }
  kLabels.forEach((lab, i) => { const st = doc.kotter?.[i] ?? {}; text(`${i + 1}. ${lab}  [${statLab[st.statut] ?? 'À faire'}]`, L + 1, 9.5, 'bold'); if (st.note) para(st.note, 3) })

  // ── Matrice de confrontation TOWS ──
  heading('12 · Matrice de confrontation (TOWS)')
  const tw = doc.tows ?? {}
  const towsSecs: [string, any][] = [['FO — Offensif (Forces × Opportunités)', tw.fo], ['WO — Réorientation (Faiblesses × Opportunités)', tw.wo], ['FA — Défensif (Forces × Menaces)', tw.fa], ['WA — Repli / Vigilance (Faiblesses × Menaces)', tw.wa]]
  towsSecs.forEach(([lab, arr]) => { sub(lab); bullets(arr) })

  // ── Vision × Axes ──
  heading('13 · Parties prenantes × Axes')
  const va = doc.matrices?.visionAxes ?? {}
  const parties: [string, string][] = [['hommes', 'Hommes'], ['marche', 'Marché / Clients'], ['environnement', 'Environnement'], ['entreprise', 'Entreprise / Actionnaires']]
  if (!axes.length) muted('Aucun axe renseigné.')
  else parties.forEach(([k, lab]) => { const line = axes.map((a: any, ai: number) => `A${ai + 1}:${grid(va[k]?.[a.id] ?? 0)}`).join('  '); text(lab, L + 1, 9.5, 'bold'); text(line, L + 3, 9, 'italic', GRAY) })

  // ── Attentes × Offre ──
  heading('14 · Attentes clients × Offre')
  const ao = doc.matrices?.attentesOffre ?? {}
  const attRows: string[] = [...(doc.attentes?.base ?? []), ...(doc.attentes?.proportionnel ?? []), ...(doc.attentes?.attractif ?? [])].filter(Boolean)
  const prod: string[] = (doc.strategie_activite?.produits ?? []).filter(Boolean)
  if (!attRows.length || !prod.length) muted('Renseignez des attentes et des produits/services pour cette matrice.')
  else attRows.forEach(att => { const line = prod.map((p: string) => `${p}:${grid(ao[slug(att)]?.[slug(p)] ?? 0)}`).join('  ·  '); text(att, L + 1, 9.5, 'bold'); text(line, L + 3, 9, 'italic', GRAY) })

  // ── Déploiement QUOI/COMMENT ──
  heading('15 · Déploiement niveau n-1 (QUOI × COMMENT)')
  const dep = doc.deploiement ?? { actions: [], scores: {} }
  const depActions = dep.actions ?? []
  if (!depActions.length) muted('Aucune action n-1 (COMMENT) définie.')
  else axes.forEach((axe: any, ai: number) => (axe.lignes ?? []).forEach((la: any, li: number) => {
    const line = depActions.map((a: any, j: number) => `${a.libelle || `Action ${j + 1}`}:${grid(dep.scores?.[la.id]?.[a.id] ?? 0)}`).join('  ·  ')
    text(`LA${ai + 1}.${li + 1} — ${t(la.enonce)}`, L + 1, 9.5, 'bold'); text(line, L + 3, 9, 'italic', GRAY)
  }))

  // ── FCS & arbre d'alignement ──
  heading('16 · Facteurs Clés de Succès & arbre d’alignement')
  if (!(doc.fcs ?? []).length) muted('Aucun FCS renseigné (3 à 5 recommandés).')
  else (doc.fcs ?? []).forEach((f: any, fi: number) => {
    sub(`FCS${fi + 1} · ${t(f.titre)}`)
    ;(f.indicateurs ?? []).forEach((ind: any, ii: number) => text(`I${fi + 1}.${ii + 1} — ${t(ind.libelle)}  →  ${t(ind.cible)}`, L + 1, 9.5))
  })

  // ── Carte stratégique ──
  heading('17 · Carte stratégique (liens de cause à effet)')
  const bscPool: Record<string, string> = {}
  bscLab.forEach(([k, lab]) => (doc.bsc?.[k] ?? []).forEach((it: any) => { bscPool[it.id] = `[${lab}] ${it.indicateur || it.objectif || '—'}` }))
  const carteLinks = (doc.carte ?? []).filter((l: any) => l.causeId && l.effetId)
  const forceLab2: Record<number, string> = { 3: 'Fort', 2: 'Moyen', 1: 'Faible' }
  if (!carteLinks.length) muted('Aucun lien cause→effet renseigné.')
  else carteLinks.forEach((l: any) => text(`• ${bscPool[l.causeId] ?? '—'}  →  ${bscPool[l.effetId] ?? '—'}   (${forceLab2[l.force] ?? '—'}${l.duree ? `, ${l.duree} mois` : ''})`, L + 1, 9.5))

  // ── Communication ──
  heading('18 · Communication de la stratégie')
  const comm = doc.communication ?? {}
  kv('Slogan', comm.slogan)
  if (comm.visuel) { sub('Visuel de référence'); para(comm.visuel) }
  if (comm.messages?.length) { sub('Messages clés'); bullets(comm.messages) }
  if (comm.objections?.length) { sub('Principales objections'); bullets(comm.objections) }
  const commCheck: [string, string][] = [['swot3', 'SWOT : 3 majeurs par cadran, sentiment d’urgence'], ['mission', 'Mission : pourquoi et chaque mot expliqués'], ['vision20', 'Vision : 20 points clés max, écarts montrés'], ['axes', 'Axes : le QUOI expliqué'], ['cascading', 'Cascading : les LA = début du COMMENT'], ['managers', 'Managers : appropriation et implication']]
  sub('Checklist « faire comprendre »')
  commCheck.forEach(([k, lab]) => text(`${comm.checklist?.[k] ? '☑' : '☐'} ${lab}`, L + 1, 9.5))

  // ── Canvas ──
  heading('19 · Business Model Canvas / Lean Canvas')
  const bmcLabels2: [string, string][] = [['segments', 'Segments de clientèle'], ['proposition', 'Proposition de valeur'], ['canaux', 'Canaux'], ['relations', 'Relations clients'], ['revenus', 'Flux de revenus'], ['ressources', 'Ressources clés'], ['activites', 'Activités clés'], ['partenaires', 'Partenariats clés'], ['couts', 'Structure de coûts']]
  const leanLabels2: [string, string][] = [['probleme', 'Problème'], ['segments', 'Segments de clients'], ['uvp', 'Proposition de valeur unique'], ['solution', 'Solution'], ['canaux', 'Canaux'], ['revenus', 'Sources de revenus'], ['couts', 'Structure de coûts'], ['indicateurs', 'Indicateurs clés'], ['avantage', 'Avantage déloyal']]
  const hasBmc = bmcLabels2.some(([k]) => (doc.canvas?.bmc?.[k] ?? []).length)
  const hasLean = leanLabels2.some(([k]) => (doc.canvas?.lean?.[k] ?? []).length)
  if (!hasBmc && !hasLean) muted('Aucun canvas renseigné.')
  if (hasBmc) { sub('Business Model Canvas (Osterwalder)'); bmcLabels2.forEach(([k, lab]) => { const items = doc.canvas?.bmc?.[k] ?? []; if (items.length) { text(lab, L + 1, 9.5, 'bold', GRAY); bullets(items) } }) }
  if (hasLean) { sub('Lean Canvas (Ash Maurya)'); leanLabels2.forEach(([k, lab]) => { const items = doc.canvas?.lean?.[k] ?? []; if (items.length) { text(lab, L + 1, 9.5, 'bold', GRAY); bullets(items) } }) }

  // Pied de page
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) { pdf.setPage(p); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(GRAY[0], GRAY[1], GRAY[2]); pdf.text(`Stratégie Partagée — ${t(orgName)}`, L, 291); pdf.text(`${p} / ${pages}`, 210 - R, 291, { align: 'right' }) }

  pdf.save(`Strategie_${(orgName || 'org').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}
