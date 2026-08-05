'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = loginSchema.safeParse({ email, password });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    logger.error({
      method: 'POST',
      route: '/auth/login',
      status: 400,
      error: error.message,
      details: { email },
    });
    return { error: error.message };
  }

  logger.info({
    method: 'POST',
    route: '/auth/login',
    status: 200,
    details: { email },
  });

  redirect('/dashboard');
}

export async function registerAction(formData: FormData) {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = registerSchema.safeParse({ fullName, email, password });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${appUrl}/dashboard`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    logger.error({
      method: 'POST',
      route: '/auth/register',
      status: 400,
      error: error.message,
      details: { email, fullName },
    });
    return { error: error.message };
  }

  logger.info({
    method: 'POST',
    route: '/auth/register',
    status: 200,
    details: { email, fullName, hasSession: !!data.session },
  });

  if (!data.session) {
    return {
      success: 'Account created! If email confirmation is enabled in your Supabase project, please check your inbox to confirm.',
    };
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
