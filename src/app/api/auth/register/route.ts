import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { email, password, full_name } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if email already exists
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Un compte avec cet email existe déjà.' }, { status: 409 })
  }

  // Create auth user (without auto-signin — using admin API)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true, // skip email confirmation
    user_metadata: { full_name: full_name?.trim() || null },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // Upsert profile with status = pending
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: full_name?.trim() || null,
      role: 'user',
      status: 'pending',
      must_change_password: false,
    }, { onConflict: 'id' })

  if (profileError) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Notify admin by email (via MS Graph — fire and forget)
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MS_CLIENT_ID!,
          client_secret: process.env.MS_CLIENT_SECRET!,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    )
    const { access_token } = await tokenRes.json()
    await fetch('https://graph.microsoft.com/v1.0/users/sylvain.cassaro@sensetho.com/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: `[Sens'ethO Apps] Nouvelle inscription en attente — ${email}`,
          body: {
            contentType: 'HTML',
            content: `<p>Un nouveau compte est en attente de validation.</p>
              <ul>
                <li><strong>Nom :</strong> ${full_name || '(non renseigné)'}</li>
                <li><strong>Email :</strong> ${email}</li>
                <li><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</li>
              </ul>
              <p><a href="https://apps.sensetho.com/admin/users">👉 Valider l'inscription</a></p>`,
          },
          toRecipients: [{ emailAddress: { address: 'sylvain.cassaro@sensetho.com' } }],
        },
      }),
    })
  } catch { /* fail-silent */ }

  return NextResponse.json({ success: true })
}
