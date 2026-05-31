export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { makeSvc, getUser } from '../_auth'

// GET /api/agri/crm/conversations?mode=acheteur|planteur
export async function GET(req: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'acheteur'
    const svc = makeSvc()

    if (mode === 'acheteur') {
      // Vérifier si admin (voit toutes les plantations)
      const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
      const isAdmin = profile?.role === 'admin'

      let plantationIds: string[]

      if (isAdmin) {
        // Admin : toutes les plantations
        const { data: allPlantations } = await svc
          .from('plantations')
          .select('id')
        plantationIds = (allPlantations ?? []).map((p: { id: string }) => p.id)
      } else {
        // 1. Toutes les plantations accessibles à cet acheteur
        const { data: accesses } = await svc
          .from('acces_acheteurs')
          .select('plantation_id')
          .eq('acheteur_user_id', user.id)
        plantationIds = (accesses ?? []).map((a: { plantation_id: string }) => a.plantation_id)
      }

      if (!plantationIds.length) return NextResponse.json({ conversations: [] })

      // 2. Détails plantations
      const { data: plantations } = await svc
        .from('plantations')
        .select('id, nom, pays_nom, user_id')
        .in('id', plantationIds)

      // 3. Profils planteurs
      const planteurIds = Array.from(new Set((plantations ?? []).map((p: { user_id: string }) => p.user_id)))
      const { data: planteurProfiles } = await svc
        .from('profiles')
        .select('id, email, full_name')
        .in('id', planteurIds)

      // 4. Messages — admin voit toutes les conversations (tous acheteurs), acheteur voit les siennes
      const messagesQuery = isAdmin
        ? svc
            .from('agri_crm_messages')
            .select('plantation_id, acheteur_user_id, content, created_at, lu_par, sender_user_id')
            .in('plantation_id', plantationIds)
            .not('acheteur_user_id', 'is', null)
            .order('created_at', { ascending: false })
        : svc
            .from('agri_crm_messages')
            .select('plantation_id, acheteur_user_id, content, created_at, lu_par, sender_user_id')
            .eq('acheteur_user_id', user.id)
            .in('plantation_id', plantationIds)
            .order('created_at', { ascending: false })

      const { data: allMessages } = await messagesQuery

      // 5. Champs (culture principale)
      const { data: champs } = await svc
        .from('champs')
        .select('plantation_id, produit_faostat')
        .in('plantation_id', plantationIds)

      if (isAdmin) {
        // Admin acheteur : grouper par (plantation_id, acheteur_user_id)
        const acheteurIds = Array.from(new Set(
          (allMessages ?? [])
            .map((m: { acheteur_user_id: string }) => m.acheteur_user_id)
            .filter(Boolean)
        ))
        const { data: acheteurProfiles } = acheteurIds.length
          ? await svc.from('profiles').select('id, email, full_name').in('id', acheteurIds)
          : { data: [] }

        const seen = new Set<string>()
        const conversations: unknown[] = []
        for (const m of (allMessages ?? []) as Array<{
          plantation_id: string; acheteur_user_id: string; content: string
          created_at: string; lu_par: string[]; sender_user_id: string
        }>) {
          const key = `${m.plantation_id}__${m.acheteur_user_id}`
          if (seen.has(key)) continue
          seen.add(key)
          const p = (plantations ?? []).find((pl: { id: string }) => pl.id === m.plantation_id) as { id: string; nom: string; pays_nom: string; user_id: string } | undefined
          const planteur = (planteurProfiles ?? []).find((pr: { id: string }) => pr.id === p?.user_id) as { email?: string; full_name?: string } | undefined
          const acheteur = (acheteurProfiles ?? []).find((pr: { id: string }) => pr.id === m.acheteur_user_id) as { email?: string; full_name?: string } | undefined
          const msgs = (allMessages ?? []).filter((x: { plantation_id: string; acheteur_user_id: string }) => x.plantation_id === m.plantation_id && x.acheteur_user_id === m.acheteur_user_id)
          const unread = msgs.filter((x: { lu_par: string[]; sender_user_id: string }) => !(x.lu_par ?? []).includes(user.id) && x.sender_user_id !== user.id).length
          const champ = (champs ?? []).find((c: { plantation_id: string }) => c.plantation_id === m.plantation_id) as { produit_faostat?: string } | undefined
          conversations.push({
            plantation_id: m.plantation_id,
            plantation_nom: p?.nom ?? '',
            pays_nom: p?.pays_nom ?? '',
            main_culture: champ?.produit_faostat ?? null,
            planteur_nom: (planteur?.full_name ?? planteur?.email ?? 'Planteur').split('@')[0],
            planteur_email: planteur?.email ?? '',
            acheteur_user_id: m.acheteur_user_id,
            acheteur_nom: (acheteur?.full_name ?? acheteur?.email ?? 'Acheteur').split('@')[0],
            last_message: m.content ?? null,
            last_message_at: m.created_at ?? null,
            unread_count: unread,
          })
        }

        // Compléter avec les paires (plantation, acheteur) de acces_acheteurs sans messages
        // → permet à l'admin de voir et initier une conv même après archivage
        const { data: allAccesses } = await svc
          .from('acces_acheteurs')
          .select('acheteur_user_id, plantation_id')
          .in('plantation_id', plantationIds)
        const existingAcheteurIdSet = new Set(acheteurIds)
        const newAcheteurIds = Array.from(new Set(
          (allAccesses ?? [])
            .map((a: { acheteur_user_id: string }) => a.acheteur_user_id)
            .filter((id: string) => !existingAcheteurIdSet.has(id))
        ))
        let allAcheteurProfiles = acheteurProfiles ?? []
        if (newAcheteurIds.length) {
          const { data: extra } = await svc.from('profiles').select('id, email, full_name').in('id', newAcheteurIds)
          allAcheteurProfiles = [...allAcheteurProfiles, ...(extra ?? [])]
        }
        for (const access of (allAccesses ?? []) as Array<{ acheteur_user_id: string; plantation_id: string }>) {
          const key = `${access.plantation_id}__${access.acheteur_user_id}`
          if (seen.has(key)) continue
          seen.add(key)
          const p = (plantations ?? []).find((pl: { id: string }) => pl.id === access.plantation_id) as { id: string; nom: string; pays_nom: string; user_id: string } | undefined
          const planteur = (planteurProfiles ?? []).find((pr: { id: string }) => pr.id === p?.user_id) as { email?: string; full_name?: string } | undefined
          const acheteur = allAcheteurProfiles.find((pr: { id: string }) => pr.id === access.acheteur_user_id) as { email?: string; full_name?: string } | undefined
          const champ = (champs ?? []).find((c: { plantation_id: string }) => c.plantation_id === access.plantation_id) as { produit_faostat?: string } | undefined
          conversations.push({
            plantation_id: access.plantation_id,
            plantation_nom: p?.nom ?? '',
            pays_nom: p?.pays_nom ?? '',
            main_culture: champ?.produit_faostat ?? null,
            planteur_nom: (planteur?.full_name ?? planteur?.email ?? 'Planteur').split('@')[0],
            planteur_email: planteur?.email ?? '',
            acheteur_user_id: access.acheteur_user_id,
            acheteur_nom: (acheteur?.full_name ?? acheteur?.email ?? 'Acheteur').split('@')[0],
            last_message: null,
            last_message_at: null,
            unread_count: 0,
          })
        }

        return NextResponse.json({ conversations })
      }

      // Acheteur non-admin : une conversation par plantation
      const conversations = (plantations ?? []).map((p: { id: string; nom: string; pays_nom: string; user_id: string }) => {
        const planteur = (planteurProfiles ?? []).find((pr: { id: string; email?: string; full_name?: string }) => pr.id === p.user_id) as { id: string; email?: string; full_name?: string } | undefined
        const msgs = (allMessages ?? []).filter((m: { plantation_id: string }) => m.plantation_id === p.id)
        const lastMsg = msgs[0] as { content: string; created_at: string; lu_par: string[]; sender_user_id: string } | undefined
        const unread = msgs.filter((m: { lu_par: string[]; sender_user_id: string }) => !(m.lu_par ?? []).includes(user.id) && m.sender_user_id !== user.id).length
        const champ = (champs ?? []).find((c: { plantation_id: string }) => c.plantation_id === p.id) as { produit_faostat?: string } | undefined
        return {
          plantation_id: p.id,
          plantation_nom: p.nom,
          pays_nom: p.pays_nom,
          main_culture: champ?.produit_faostat ?? null,
          planteur_nom: (planteur?.full_name ?? planteur?.email ?? 'Planteur').split('@')[0],
          planteur_email: planteur?.email ?? '',
          acheteur_user_id: user.id,
          last_message: lastMsg?.content ?? null,
          last_message_at: lastMsg?.created_at ?? null,
          unread_count: unread,
        }
      })

      return NextResponse.json({ conversations })
    }

    if (mode === 'planteur') {
      // Vérifier si admin
      const { data: profileAdmin } = await svc.from('profiles').select('role').eq('id', user.id).single()
      const isAdminUser = profileAdmin?.role === 'admin'

      // plantation_id optionnel — si fourni, on restreint à cette plantation uniquement
      const plantationIdFilter = searchParams.get('plantation_id')

      // 1. Plantations visibles : filtrées par plantation_id si fourni
      //    Pour un non-admin, on vérifie aussi la propriété (user_id = user.id)
      let plantationsQuery = isAdminUser
        ? svc.from('plantations').select('id, nom, pays_nom')
        : svc.from('plantations').select('id, nom, pays_nom').eq('user_id', user.id)

      if (plantationIdFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plantationsQuery = (plantationsQuery as any).eq('id', plantationIdFilter)
      }

      const { data: plantations } = await plantationsQuery

      const plantationIds = (plantations ?? []).map((p: { id: string }) => p.id)
      if (!plantationIds.length) return NextResponse.json({ conversations: [] })

      // 2. Tous les messages reçus (envoyés par des acheteurs)
      const { data: allMessages } = await svc
        .from('agri_crm_messages')
        .select('plantation_id, acheteur_user_id, content, created_at, lu_par, sender_user_id')
        .in('plantation_id', plantationIds)
        .not('acheteur_user_id', 'is', null)
        .order('created_at', { ascending: false })

      // 3. Profils acheteurs distincts
      const acheteurIds = Array.from(new Set((allMessages ?? []).map((m: { acheteur_user_id: string }) => m.acheteur_user_id).filter(Boolean)))
      const { data: profiles } = acheteurIds.length
        ? await svc.from('profiles').select('id, email, full_name').in('id', acheteurIds)
        : { data: [] }

      // 4. Grouper par acheteur + plantation (messages existants)
      const seen = new Set<string>()
      const conversations: unknown[] = []
      for (const m of (allMessages ?? []) as Array<{ plantation_id: string; acheteur_user_id: string; content: string; created_at: string; lu_par: string[]; sender_user_id: string }>) {
        const key = `${m.plantation_id}__${m.acheteur_user_id}`
        if (seen.has(key)) continue
        seen.add(key)
        const plantation = (plantations ?? []).find((p: { id: string }) => p.id === m.plantation_id) as { nom: string; pays_nom: string } | undefined
        const acheteur = (profiles ?? []).find((p: { id: string }) => p.id === m.acheteur_user_id) as { email?: string; full_name?: string } | undefined
        const msgs = (allMessages ?? []).filter((x: { plantation_id: string; acheteur_user_id: string }) => x.plantation_id === m.plantation_id && x.acheteur_user_id === m.acheteur_user_id)
        const unread = msgs.filter((x: { lu_par: string[]; sender_user_id: string }) => !(x.lu_par ?? []).includes(user.id) && x.sender_user_id !== user.id).length
        conversations.push({
          plantation_id: m.plantation_id,
          plantation_nom: plantation?.nom ?? '',
          pays_nom: plantation?.pays_nom ?? '',
          acheteur_user_id: m.acheteur_user_id,
          acheteur_nom: (acheteur?.full_name ?? acheteur?.email ?? 'Acheteur').split('@')[0],
          acheteur_email: acheteur?.email ?? '',
          last_message: m.content,
          last_message_at: m.created_at,
          unread_count: unread,
        })
      }

      // 5. Compléter avec les acheteurs autorisés sans messages (acces_acheteurs)
      // → planteur peut initier/re-initier une conv même après archivage
      const { data: allAccesses } = await svc
        .from('acces_acheteurs')
        .select('acheteur_user_id, plantation_id')
        .in('plantation_id', plantationIds)
      const knownIds = new Set(acheteurIds)
      const missingIds = Array.from(new Set(
        (allAccesses ?? [])
          .map((a: { acheteur_user_id: string }) => a.acheteur_user_id)
          .filter((id: string) => !knownIds.has(id))
      ))
      let allProfiles = profiles ?? []
      if (missingIds.length) {
        const { data: extra } = await svc.from('profiles').select('id, email, full_name').in('id', missingIds)
        allProfiles = [...allProfiles, ...(extra ?? [])]
      }
      for (const access of (allAccesses ?? []) as Array<{ acheteur_user_id: string; plantation_id: string }>) {
        const key = `${access.plantation_id}__${access.acheteur_user_id}`
        if (seen.has(key)) continue
        seen.add(key)
        const plantation = (plantations ?? []).find((p: { id: string }) => p.id === access.plantation_id) as { nom: string; pays_nom: string } | undefined
        const acheteur = allProfiles.find((p: { id: string }) => p.id === access.acheteur_user_id) as { email?: string; full_name?: string } | undefined
        conversations.push({
          plantation_id: access.plantation_id,
          plantation_nom: plantation?.nom ?? '',
          pays_nom: plantation?.pays_nom ?? '',
          acheteur_user_id: access.acheteur_user_id,
          acheteur_nom: (acheteur?.full_name ?? acheteur?.email ?? 'Acheteur').split('@')[0],
          acheteur_email: acheteur?.email ?? '',
          last_message: null,
          last_message_at: null,
          unread_count: 0,
        })
      }

      return NextResponse.json({ conversations })
    }

    return NextResponse.json({ error: 'mode invalide' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
