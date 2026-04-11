import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

Deno.serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20',
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Webhook signature verification failed:', msg)
    return new Response(`Webhook Error: ${msg}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Only handle paid sessions
    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userId = session.metadata?.user_id
    if (!userId) {
      console.error('No user_id in session metadata')
      return new Response('Missing user_id', { status: 400 })
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, is_pro: true, pro_since: new Date().toISOString() },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('Error marking user as Pro:', error)
      return new Response('Database error', { status: 500 })
    }

    console.log(`User ${userId} upgraded to Pro`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
