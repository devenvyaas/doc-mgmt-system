'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/auth/actions';
import { Profile } from '@/lib/types';
import {
  FileText,
  User,
  Shield,
  Zap,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';

interface NavbarProps {
  profile: Profile | null;
}

export default function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-100 tracking-tight">
              DocVault <span className="text-indigo-400 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">AI</span>
            </span>
          </Link>

          {/* Navigation Links */}
          {profile && (
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                  pathname === '/dashboard'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {profile.role === 'admin' && (
                <Link
                  href="/admin/dashboard"
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition ${
                    pathname.startsWith('/admin')
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        {/* User Profile & Actions */}
        {profile ? (
          <div className="flex items-center gap-3">
            {/* Subscription Tier Badge */}
            {profile.subscription_tier === 'pro' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300 border border-amber-500/30 shadow-sm">
                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                PRO
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                FREE PLAN
              </span>
            )}

            {/* User Role Badge */}
            {profile.role === 'admin' && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ADMIN
              </span>
            )}

            {/* Profile Dropdown / Link */}
            <Link
              href="/profile"
              className={`p-2 rounded-xl border flex items-center gap-2 text-sm transition ${
                pathname === '/profile'
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-800'
              }`}
              title="View Profile"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span className="hidden lg:inline text-xs font-medium max-w-[120px] truncate">
                {profile.full_name || profile.email}
              </span>
            </Link>

            {/* Logout Button */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-2 rounded-xl bg-slate-800/60 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/30 transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
