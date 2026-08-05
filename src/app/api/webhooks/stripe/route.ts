import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const route = '/api/webhooks/stripe';
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: 'Missing webhook secret or signature' });
    return NextResponse.json(
      { error: 'Missing webhook secret or signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ method: 'POST', route, status: 400, durationMs: Date.now() - startTime, error: `Webhook Error: ${message}` });
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        if (userId) {
          await supabaseAdmin
            .from('profiles')
            .update({
              subscription_tier: 'pro',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
        const status = subscription.status;

        const isPro = status === 'active' || status === 'trialing';

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: isPro ? 'pro' : 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    logger.info({
      method: 'POST',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { eventType: event.type },
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : 'Webhook handler failed' });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
