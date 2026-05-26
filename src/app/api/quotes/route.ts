import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { app_slug, email, company, users_count, message } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Trouver l'app_id depuis le slug
    let app_id: string | null = null
    if (app_slug) {
      const { data: app } = await admin
        .from('apps')
        .select('id')
        .eq('slug', app_slug)
        .maybeSingle()
      app_id = app?.id ?? null
    }

    if (app_slug && !app_id) {
      return NextResponse.json({ error: `Application "${app_slug}" introuvable` }, { status: 404 })
    }

    // Insérer la demande dans app_quotes
    const { data, error } = await admin
      .from('app_quotes')
      .insert({
        app_id,
        email,
        company: company || null,
        users_count: users_count || null,
        message: message || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw error

    // Notification email via Microsoft Graph (optionnel — fail-silent)
    try {
      await sendNotification({ email, company, app_slug, users_count, message })
    } catch {
      // La notification échoue sans bloquer la réponse
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[POST /api/quotes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Notification email admin ─────────────────────────────────────────────────

async function sendNotification(params: {
  email: string
  company: string | null
  app_slug: string | null
  users_count: number | null
  message: string | null
}) {
  const tenantId  = process.env.MS_TENANT_ID
  const clientId  = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) return

  // Obtenir token MS Graph
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  )
  if (!tokenRes.ok) return
  const { access_token } = await tokenRes.json()

  const adminEmail = 'sylvain.cassaro@sensetho.com'
  const body = [
    `<b>Nouvelle demande d'accès / devis</b>`,
    ``,
    `<b>Application :</b> ${params.app_slug ?? '(non spécifiée)'}`,
    `<b>Email :</b> ${params.email}`,
    `<b>Société :</b> ${params.company ?? '–'}`,
    `<b>Utilisateurs :</b> ${params.users_count ?? '–'}`,
    ``,
    `<b>Message :</b>`,
    params.message ? params.message.replace(/\n/g, '<br>') : '–',
    ``,
    `<hr><small>Gérer depuis <a href="https://apps.sensetho.com/admin/quotes">apps.sensetho.com/admin/quotes</a></small>`,
  ].join('<br>')

  await fetch(
    `https://graph.microsoft.com/v1.0/users/${adminEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: `[apps.sensetho.com] Demande d'accès — ${params.app_slug ?? 'application'}`,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: adminEmail } }],
        },
      }),
    }
  )
}
