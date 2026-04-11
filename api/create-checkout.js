import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' })

    // Verify the user's JWT using their own token (anon key + user JWT)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })

    // Guard: don't create a session if already Pro
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_pro) return res.status(400).json({ error: 'already_pro' })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const origin = req.headers.origin ?? `https://${req.headers.host}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { user_id: user.id },
      customer_email: user.email,
      success_url: `${origin}/premium?success=true`,
      cancel_url: `${origin}/premium`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout]', err)
    return res.status(500).json({ error: err.message ?? 'Internal error' })
  }
}
