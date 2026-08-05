'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Profile, Document } from '@/lib/types';
import {
  Users,
  FileText,
  Zap,
  Shield,
  Search,
  Trash2,
  Download,
  Loader2,
  UserX,
  File,
  FileCode,
  Image as ImageIcon,
} from 'lucide-react';

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'users' | 'documents'>('users');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function loadAdminData() {
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

      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: docsData } = await supabase
        .from('documents')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false });

      if (isMounted) {
        if (prof) setProfile(prof as Profile);
        if (usersData) setAllUsers(usersData as Profile[]);
        if (docsData) setAllDocuments(docsData as Document[]);
        setLoading(false);
      }
    }
    loadAdminData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update User Subscription Tier
  async function handleToggleSubscription(userId: string, currentTier: string) {
    const nextTier = currentTier === 'pro' ? 'free' : 'pro';
    setActionLoading(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ subscription_tier: nextTier, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      alert(`Failed to update subscription: ${error.message}`);
    } else {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, subscription_tier: nextTier } : u))
      );
    }
    setActionLoading(null);
  }

  // Update User Role
  async function handleToggleRole(userId: string, currentRole: string) {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    setActionLoading(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      alert(`Failed to update role: ${error.message}`);
    } else {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
      );
    }
    setActionLoading(null);
  }

  // Admin Delete Document
  async function handleDeleteDocument(docId: string) {
    if (!confirm('Admin Confirmation: Delete this document from storage and database?')) return;
    setActionLoading(docId);

    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setAllDocuments((prev) => prev.filter((d) => d.id !== docId));
      } else {
        alert(data.error || 'Failed to delete document');
      }
    } catch {
      alert('Delete error occurred');
    } finally {
      setActionLoading(null);
    }
  }

  // Admin Download Document
  async function handleDownloadDocument(docId: string) {
    setActionLoading(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/download`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Download failed');
      }
    } catch {
      alert('Download error occurred');
    } finally {
      setActionLoading(null);
    }
  }

  // Calculate Admin Stats
  const totalUsers = allUsers.length;
  const totalDocuments = allDocuments.length;
  const freeUsersCount = allUsers.filter((u) => u.subscription_tier === 'free').length;
  const proUsersCount = allUsers.filter((u) => u.subscription_tier === 'pro').length;

  const filteredUsers = allUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDocuments = allDocuments.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function getFileIcon(type: string) {
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (type.includes('word') || type.includes('document'))
      return <FileCode className="w-4 h-4 text-blue-400" />;
    if (type.includes('image')) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-slate-400" />;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-400" />
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Admin Management Portal
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              System-wide statistics, user roles, subscription overrides, and file control.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Users
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">{totalUsers}</h2>
              <p className="text-xs text-slate-500 mt-1">Registered profiles</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total System Files
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">{totalDocuments}</h2>
              <p className="text-xs text-slate-500 mt-1">All uploaded files</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Free Plan Users
              </p>
              <h2 className="text-3xl font-bold text-slate-300 mt-2">{freeUsersCount}</h2>
              <p className="text-xs text-slate-500 mt-1">Standard limit</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <UserX className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pro Subscribers
              </p>
              <h2 className="text-3xl font-bold text-amber-400 mt-2">{proUsersCount}</h2>
              <p className="text-xs text-slate-500 mt-1">Unlimited tier</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Search Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Management ({totalUsers})</span>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                activeTab === 'documents'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>System Documents ({totalDocuments})</span>
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={activeTab === 'users' ? 'Search by email or name...' : 'Search document titles...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm">Fetching system administration data...</p>
          </div>
        ) : activeTab === 'users' ? (
          /* Users Management Table */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Subscription</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-200">
                            {u.full_name || 'No Name'}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            USER
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {u.subscription_tier === 'pro' ? (
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Zap className="w-3 h-3 fill-amber-400" />
                            PRO
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            FREE
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleSubscription(u.id, u.subscription_tier)}
                            disabled={actionLoading === u.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-amber-400 hover:bg-amber-500/10 border border-slate-700 hover:border-amber-500/30 transition disabled:opacity-50"
                          >
                            Toggle Tier ({u.subscription_tier === 'pro' ? 'Free' : 'Pro'})
                          </button>

                          <button
                            onClick={() => handleToggleRole(u.id, u.role)}
                            disabled={actionLoading === u.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-purple-400 hover:bg-purple-500/10 border border-slate-700 hover:border-purple-500/30 transition disabled:opacity-50"
                          >
                            Toggle Role ({u.role === 'admin' ? 'User' : 'Admin'})
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* System Documents Table */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Document</th>
                    <th className="px-6 py-4">Uploaded By</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                            {getFileIcon(doc.file_type)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-slate-500 truncate max-w-xs">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-slate-300">
                          {doc.profiles?.full_name || 'User'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {doc.profiles?.email}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {doc.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {formatBytes(doc.file_size)}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownloadDocument(doc.id)}
                            disabled={actionLoading === doc.id}
                            className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-700/60 transition"
                            title="Download Document"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={actionLoading === doc.id}
                            className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/60 transition"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
