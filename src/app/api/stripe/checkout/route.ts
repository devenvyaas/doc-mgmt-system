import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';
import { logger } from '@/lib/logger';

export async function POST() {
  const startTime = Date.now();
  const route = '/api/stripe/checkout';

  try {
    const supabase = await createClient();

    // 1. Authenticate User
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error({ method: 'POST', route, status: 401, durationMs: Date.now() - startTime, error: 'Unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch User Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      logger.error({ method: 'POST', route, status: 404, durationMs: Date.now() - startTime, error: 'User profile not found' });
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      const errMsg = 'Stripe Pro price ID is not configured in environment variables.';
      logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: errMsg });
      return NextResponse.json(
        { error: errMsg },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
      },
      success_url: `${appUrl}/dashboard?payment=success`,
      cancel_url: `${appUrl}/dashboard?payment=cancelled`,
    });

    logger.info({
      method: 'POST',
      route,
      status: 200,
      durationMs: Date.now() - startTime,
      details: { sessionId: session.id, userId: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create checkout session';
    logger.error({ method: 'POST', route, status: 500, durationMs: Date.now() - startTime, error: err instanceof Error ? err : errorMessage });
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
