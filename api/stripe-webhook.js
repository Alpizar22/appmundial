import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Disable Vercel's automatic body parsing so Stripe can verify the raw payload
export const config = {
  api: { bodyParser: false },
}

/** Collect the raw request body as a Buffer */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  const signature = req.headers['stripe-signature']

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // Ignore unpaid sessions (e.g. free trials that haven't charged yet)
    if (session.payment_status !== 'paid') {
      return res.status(200).json({ received: true })
    }

    const userId = session.metadata?.user_id
    if (!userId) {
      console.error('[stripe-webhook] No user_id in metadata')
      return res.status(400).json({ error: 'Missing user_id in metadata' })
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, is_pro: true, pro_since: new Date().toISOString() },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('[stripe-webhook] DB error:', error)
      return res.status(500).json({ error: 'Database error' })
    }

    console.log(`[stripe-webhook] User ${userId} upgraded to Pro`)
  }

  return res.status(200).json({ received: true })
}
