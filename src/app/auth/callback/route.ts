import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tenantDeLaSession } from '@/lib/sso/tenant'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Microsoft renvoie ses refus en paramètres, sans code. Les ignorer faisait
  // revenir l'utilisateur comme si de rien n'était : consentement donné, aucun
  // rattachement, aucune explication. Le motif est propagé tel quel.
  const refusFournisseur = searchParams.get('error_description') ?? searchParams.get('error')
  if (refusFournisseur) {
    return NextResponse.redirect(`${origin}${destinationErreur(next, refusFournisseur)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}${destinationErreur(next, error.message)}`)
    }
    const refus = await refuserSiTenantNonAutorise(supabase, data)
    if (refus) return NextResponse.redirect(`${origin}${refus}`)
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback`)
}

/**
 * Où renvoyer un échec. Un rattachement lancé depuis le compte doit revenir au
 * compte : le renvoyer vers la page de connexion, alors que la session est
 * toujours valide, produisait un aller-retour muet vers le tableau de bord.
 */
function destinationErreur(next: string, motif: string): string {
  const m = encodeURIComponent(motif.slice(0, 300))
  return next.startsWith('/account')
    ? `/account?lien=echec&motif=${m}`
    : `/auth/login?error=callback&motif=${m}`
}

type Client = Awaited<ReturnType<typeof createClient>>
type Echange = Awaited<ReturnType<Client['auth']['exchangeCodeForSession']>>['data']

/**
 * Refuse une connexion Microsoft venant d'un annuaire absent de la liste blanche.
 *
 * L'inscription Entra est déclarée multilocataire : sans ce contrôle, n'importe
 * quel utilisateur d'un annuaire Microsoft dans le monde obtiendrait un compte.
 * Le filtrage vit ici, dans l'application, pour que les administrateurs gèrent
 * les tenants sans passer par le portail Azure.
 *
 * Renvoie le chemin de redirection en cas de refus, null si l'accès est accordé.
 */
async function refuserSiTenantNonAutorise(supabase: Client, data: Echange): Promise<string | null> {
  const user = data.user
  // Seules les sessions issues du fournisseur azure sont concernées : la
  // connexion par mot de passe garde son propre parcours.
  const parAzure = (user?.identities ?? []).some(i => i.provider === 'azure')
  if (!user || !parAzure) return null

  const tenant = tenantDeLaSession(user, data.session?.provider_token)
  const admin = createAdminClient()

  // Faute de pouvoir déterminer l'annuaire, on refuse : mieux vaut une connexion
  // bloquée qu'un compte créé depuis un annuaire inconnu.
  if (!tenant) {
    await supabase.auth.signOut()
    return '/auth/login?error=sso_tenant_inconnu'
  }

  const { data: autorise, error } = await admin.rpc('sso_tenant_autorise', { p_tenant_id: tenant })
  // Une base injoignable ne doit pas se traduire par « organisation refusée » :
  // le message doit dire la vérité sur la cause.
  if (error) {
    await supabase.auth.signOut()
    return '/auth/login?error=sso_indisponible'
  }
  if (!autorise) {
    await supabase.auth.signOut()
    return `/auth/login?error=sso_tenant_refuse&tid=${tenant}`
  }

  // Mémorise l'annuaire d'origine : c'est lui qui permettra de couper l'accès
  // si le tenant est désactivé plus tard, une fois le compte déjà créé.
  await admin.from('profiles').update({ sso_tenant_id: tenant }).eq('id', user.id)
  return null
}
