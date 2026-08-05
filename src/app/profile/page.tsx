'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import {
  User,
  Mail,
  Zap,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [stripeLoading, setStripeLoading] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (isMounted) {
        if (prof) {
          setProfile(prof as Profile);
          setFullName(prof.full_name || '');
        }
        setLoading(false);
      }
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      setMessage({ type: 'error', text: `Failed to update profile: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setProfile((prev) => (prev ? { ...prev, full_name: fullName } : null));
    }
    setSaving(false);
  }

  async function handleUpgrade() {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start Stripe Checkout');
      }
    } catch {
      alert('Error initiating checkout session');
    } finally {
      setStripeLoading(false);
    }
  }


  const isPro = profile?.subscription_tier === 'pro';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            User Profile Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your personal profile, role permissions, and active subscription plan.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading profile credentials...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Account Summary Card */}
            <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-indigo-600/30 mb-4">
                {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
              </div>

              <h2 className="text-lg font-bold text-white">{profile?.full_name || 'User'}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{profile?.email}</p>

              <div className="mt-6 w-full space-y-3 pt-6 border-t border-slate-800 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Assigned Role:</span>
                  <span className="font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                    {profile?.role}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Subscription Tier:</span>
                  {isPro ? (
                    <span className="font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Zap className="w-3 h-3 fill-amber-400" />
                      PRO
                    </span>
                  ) : (
                    <span className="font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      FREE
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Member Since:</span>
                  <span className="text-slate-300">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Edit & Subscription Management */}
            <div className="md:col-span-2 space-y-6">
              {/* Form Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                <h3 className="text-base font-bold text-white mb-4">Edit Personal Information</h3>

                {message && (
                  <div
                    className={`mb-6 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      message.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{message.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Email Address (Read-only)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        disabled
                        value={profile?.email || ''}
                        className="w-full bg-slate-950/60 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Subscription Management Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Subscription Status</h3>
                      <p className="text-xs text-slate-400">
                        {isPro
                          ? 'You are on the Pro Plan with unlimited document uploads and 100MB file limit.'
                          : 'You are on the Free Plan (Limited to 5 uploads & 10MB file size).'}
                      </p>
                    </div>
                  </div>

                  {!isPro && (
                    <button
                      onClick={handleUpgrade}
                      disabled={stripeLoading}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 shrink-0"
                    >
                      {stripeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 fill-slate-950" />
                      )}
                      <span>Upgrade to Pro ($19/mo)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
