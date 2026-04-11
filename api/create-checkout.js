import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Validate env vars first so misconfiguration is obvious in logs ────────
  const missing = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
    .filter((k) => !process.env[k])

  if (missing.length) {
    console.error('[create-checkout] Missing env vars:', missing.join(', '))
    return res.status(500).json({ error: `Server misconfigured: ${missing.join(', ')} not set` })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' })

    // Verify the caller's JWT via Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[create-checkout] Auth error:', userError?.message)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Guard: skip if already Pro
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_pro) return res.status(400).json({ error: 'already_pro' })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    })

    const origin = req.headers.origin ?? `https://${req.headers.host}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { user_id: user.id },
      customer_email: user.email,
      success_url: `${origin}/premium?success=true`,
      cancel_url: `${origin}/premium`,
    })

    console.log(`[create-checkout] Session created for user ${user.id}`)
    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout] Error:', err.message, err.type ?? '')
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
