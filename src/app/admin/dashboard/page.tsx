'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { getOrEnsureProfile } from '@/lib/supabase/profile';
import { Profile, Document } from '@/lib/types';
import {
  Users,
  FileText,
  Zap,
  Shield,
  Search,
  Trash2,
  Download,
  Eye,
  Pencil,
  Loader2,
  UserX,
  File,
  FileCode,
  Image as ImageIcon,
  X,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function AdminDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchingDocs, setFetchingDocs] = useState<boolean>(false);
  const [fetchingUsers, setFetchingUsers] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'documents'>('users');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Total Overview Counters
  const [totalUserCount, setTotalUserCount] = useState<number>(0);
  const [totalDocCount, setTotalDocCount] = useState<number>(0);
  const [totalProCount, setTotalProCount] = useState<number>(0);
  const [totalFreeCount, setTotalFreeCount] = useState<number>(0);

  // Users Tab Pagination (10 items per page)
  const [userPage, setUserPage] = useState<number>(1);
  const [userTotalPages, setUserTotalPages] = useState<number>(1);

  // Documents Tab Pagination (10 items per page)
  const [docPage, setDocPage] = useState<number>(1);
  const [docTotalPages, setDocTotalPages] = useState<number>(1);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Edit Modal State for Admin
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('General');
  const [updating, setUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const supabase = createClient();
  const limit = 10;

  // 1. Initial Overview Data Load (Counts & Admin Profile)
  useEffect(() => {
    let isMounted = true;
    async function loadAdminOverview() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      const prof = await getOrEnsureProfile(
        supabase,
        user.id,
        user.email || '',
        user.user_metadata?.full_name
      );

      // Fetch Total System Document Count
      const { count: docsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });

      // Fetch Total Users & Plan Breakdown
      const { data: usersData, count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (isMounted) {
        if (prof) setProfile(prof);
        if (docsCount !== null) setTotalDocCount(docsCount);
        if (usersCount !== null) setTotalUserCount(usersCount);

        if (usersData) {
          setTotalProCount(usersData.filter((u) => u.subscription_tier === 'pro').length);
          setTotalFreeCount(usersData.filter((u) => u.subscription_tier === 'free').length);
        }
        setLoading(false);
      }
    }
    loadAdminOverview();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // 2. Fetch Users Tab with Pagination (10 per page)
  const fetchAdminUsers = useCallback(
    async (search: string, pageNum: number) => {
      setFetchingUsers(true);
      try {
        const from = (pageNum - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact' });

        if (search.trim()) {
          query = query.or(`email.ilike.%${search.trim()}%,full_name.ilike.%${search.trim()}%`);
        }

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data: usersData, count, error } = await query;

        if (!error && usersData) {
          setAllUsers(usersData as Profile[]);
          if (count !== null) {
            setTotalUserCount(count);
            setUserTotalPages(Math.max(1, Math.ceil(count / limit)));
          }
        }
      } catch (err) {
        console.error('Error fetching admin users:', err);
      } finally {
        setFetchingUsers(false);
      }
    },
    [supabase]
  );

  // 3. Fetch Documents Tab with Pagination (10 per page)
  const fetchAdminDocuments = useCallback(
    async (search: string, cat: string, pageNum: number) => {
      setFetchingDocs(true);
      try {
        const params = new URLSearchParams();
        params.set('admin', 'true');
        params.set('page', pageNum.toString());
        params.set('limit', limit.toString());
        if (search.trim()) params.set('search', search.trim());
        if (cat && cat !== 'All') params.set('category', cat);

        const res = await fetch(`/api/documents?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.documents) {
          setAllDocuments(data.documents);
          setTotalDocCount(data.totalCount || 0);
          setDocTotalPages(data.totalPages || 1);
        } else {
          console.error('Failed to fetch admin documents:', data.error);
        }
      } catch (err) {
        console.error('Error fetching admin documents:', err);
      } finally {
        setFetchingDocs(false);
      }
    },
    []
  );

  // Tab 1 Fetch (Users)
  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => {
        fetchAdminUsers(searchQuery, userPage);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, searchQuery, userPage, fetchAdminUsers]);

  // Tab 2 Fetch (Documents)
  useEffect(() => {
    if (activeTab === 'documents') {
      const timer = setTimeout(() => {
        fetchAdminDocuments(searchQuery, selectedCategory, docPage);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, searchQuery, selectedCategory, docPage, fetchAdminDocuments]);

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
        prev.map((u) =>
          u.id === userId ? { ...u, subscription_tier: nextTier as 'free' | 'pro' } : u
        )
      );
      setTotalProCount((prev) => (nextTier === 'pro' ? prev + 1 : Math.max(0, prev - 1)));
      setTotalFreeCount((prev) => (nextTier === 'free' ? prev + 1 : Math.max(0, prev - 1)));
    }
    setActionLoading(null);
  }

  // Update User Role (User vs Admin)
  async function handleToggleRole(userId: string, currentRole: string) {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    if (
      !confirm(
        `Are you sure you want to change this user's role to ${nextRole.toUpperCase()}?`
      )
    )
      return;

    setActionLoading(userId);

    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      alert(`Failed to update role: ${error.message}`);
    } else {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: nextRole as 'user' | 'admin' } : u))
      );
    }
    setActionLoading(null);
  }

  // Open Document View / Download Actions
  async function handleDocumentAction(docId: string, mode: 'view' | 'download') {
    const actionKey = `${docId}-${mode}`;
    setActionLoading(actionKey);
    try {
      const res = await fetch(`/api/documents/${docId}/download?mode=${mode}`);
      const data = await res.json();

      if (data.downloadUrl) {
        if (mode === 'view') {
          window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
        } else {
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.rel = 'noopener noreferrer';
          a.click();
        }
      } else {
        alert(data.error || 'Failed to generate document access link');
      }
    } catch {
      alert('Error connecting to download server');
    } finally {
      setActionLoading(null);
    }
  }

  // Handle Admin Document Details Update (PATCH)
  async function handleAdminUpdateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;

    setUpdating(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/documents/${editingDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          category: editCategory,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.error || 'Failed to update document');
      } else {
        setEditingDoc(null);
        fetchAdminDocuments(searchQuery, selectedCategory, docPage);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  // Delete Document System-wide
  async function handleDeleteDocument(docId: string) {
    if (!confirm('ADMIN WARNING: Are you sure you want to permanently delete this user document?'))
      return;

    setActionLoading(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });

      if (res.ok) {
        fetchAdminDocuments(searchQuery, selectedCategory, docPage);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch {
      alert('Error executing administrative deletion');
    } finally {
      setActionLoading(null);
    }
  }

  function getFileIcon(type: string) {
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />;
    if (type.includes('word') || type.includes('docx'))
      return <FileCode className="w-5 h-5 text-blue-400" />;
    if (type.includes('image')) return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  const userStartRange = totalUserCount === 0 ? 0 : (userPage - 1) * limit + 1;
  const userEndRange = Math.min(userPage * limit, totalUserCount);

  const docStartRange = totalDocCount === 0 ? 0 : (docPage - 1) * limit + 1;
  const docEndRange = Math.min(docPage * limit, totalDocCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span>Administrative Oversight Portal</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              System Admin Dashboard
            </h1>
          </div>
        </div>

        {/* Analytics Statistics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Users</p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{totalUserCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Documents</p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{totalDocCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pro Subscriptions</p>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{totalProCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Free Users</p>
              <h3 className="text-3xl font-extrabold text-slate-300 mt-1">{totalFreeCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <UserX className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab & Controls Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'users'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>User Accounts ({totalUserCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
                activeTab === 'documents'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>System Documents ({totalDocCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={activeTab === 'users' ? 'Search users...' : 'Search document titles...'}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setUserPage(1);
                  setDocPage(1);
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            {activeTab === 'documents' && (
              <div className="flex items-center gap-1 overflow-x-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                {['All', 'General', 'Work', 'Personal', 'Finance', 'Legal'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setDocPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: User Management Table */}
        {activeTab === 'users' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden min-h-[250px] flex flex-col justify-between">
            {loading || fetchingUsers ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <p className="text-sm">Fetching user directory...</p>
              </div>
            ) : allUsers.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                <Users className="w-8 h-8 text-slate-600" />
                <p className="text-sm text-slate-400">No user accounts found matching your query.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Subscription Plan</th>
                        <th className="px-6 py-4">Joined Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {allUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
                                {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-100 text-sm">
                                  {u.full_name || 'User'}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {u.role === 'admin' ? (
                              <span className="px-2.5 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                ADMIN
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                USER
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {u.subscription_tier === 'pro' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                PRO PLAN
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                FREE PLAN
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-xs text-slate-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Toggle Subscription */}
                              <button
                                onClick={() => handleToggleSubscription(u.id, u.subscription_tier)}
                                disabled={actionLoading === u.id}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-amber-300 border border-slate-700 transition flex items-center gap-1.5"
                                title="Toggle Subscription Tier"
                              >
                                {actionLoading === u.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5" />
                                )}
                                <span>{u.subscription_tier === 'pro' ? 'Downgrade' : 'Upgrade Pro'}</span>
                              </button>

                              {/* Toggle Role */}
                              <button
                                onClick={() => handleToggleRole(u.id, u.role)}
                                disabled={actionLoading === u.id}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-purple-300 border border-slate-700 transition flex items-center gap-1.5"
                                title="Toggle Role"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span>{u.role === 'admin' ? 'Make User' : 'Make Admin'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Users Pagination Bar (10 users per page) */}
                <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Showing <span className="font-semibold text-slate-200">{userStartRange}</span> -{' '}
                    <span className="font-semibold text-slate-200">{userEndRange}</span> of{' '}
                    <span className="font-semibold text-slate-200">{totalUserCount}</span> users
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                      disabled={userPage === 1}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-3 py-1 rounded-lg bg-purple-600/15 text-purple-300 border border-purple-500/20 font-medium">
                      Page {userPage} of {userTotalPages || 1}
                    </span>

                    <button
                      onClick={() => setUserPage((prev) => Math.min(userTotalPages, prev + 1))}
                      disabled={userPage >= userTotalPages}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: System Documents Table */}
        {activeTab === 'documents' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden min-h-[250px] flex flex-col justify-between">
            {fetchingDocs ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-sm">Querying system documents...</p>
              </div>
            ) : allDocuments.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                <FileText className="w-8 h-8 text-slate-600" />
                <p className="text-sm text-slate-400">No system documents found matching your filter.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Document</th>
                        <th className="px-6 py-4">Uploader</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Size</th>
                        <th className="px-6 py-4 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {allDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                                {getFileIcon(doc.file_type)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-100 text-sm line-clamp-1">
                                  {doc.title}
                                </p>
                                {doc.description && (
                                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                    {doc.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-xs font-mono text-slate-400">
                            {doc.profiles?.full_name || doc.profiles?.email || 'User'}
                          </td>

                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {doc.category}
                            </span>
                          </td>

                          <td className="px-6 py-4 font-mono text-xs text-slate-400">
                            {formatBytes(doc.file_size)}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Dedicated Eye Icon (View in New Tab) */}
                              <button
                                onClick={() => handleDocumentAction(doc.id, 'view')}
                                disabled={actionLoading === `${doc.id}-view`}
                                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-700 transition disabled:opacity-50"
                                title="View Document in New Tab"
                              >
                                {actionLoading === `${doc.id}-view` ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>

                              {/* Dedicated Download Icon (Exact DB Title Filename) */}
                              <button
                                onClick={() => handleDocumentAction(doc.id, 'download')}
                                disabled={actionLoading === `${doc.id}-download`}
                                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 border border-slate-700 transition disabled:opacity-50"
                                title="Download Document"
                              >
                                {actionLoading === `${doc.id}-download` ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>

                              {/* Edit Document Pencil Button */}
                              <button
                                onClick={() => {
                                  setEditingDoc(doc);
                                  setEditTitle(doc.title);
                                  setEditDescription(doc.description || '');
                                  setEditCategory(doc.category || 'General');
                                }}
                                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-700 transition"
                                title="Edit Document Details"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Admin Delete Button */}
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={actionLoading === doc.id}
                                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 transition"
                                title="Permanently Delete Document"
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

                {/* System Documents Pagination Bar (10 docs per page) */}
                <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    Showing <span className="font-semibold text-slate-200">{docStartRange}</span> -{' '}
                    <span className="font-semibold text-slate-200">{docEndRange}</span> of{' '}
                    <span className="font-semibold text-slate-200">{totalDocCount}</span> documents
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDocPage((prev) => Math.max(1, prev - 1))}
                      disabled={docPage === 1}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-3 py-1 rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 font-medium">
                      Page {docPage} of {docTotalPages || 1}
                    </span>

                    <button
                      onClick={() => setDocPage((prev) => Math.min(docTotalPages, prev + 1))}
                      disabled={docPage >= docTotalPages}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Admin Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                Admin Edit Document Details
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleAdminUpdateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition"
                >
                  <option value="General">General</option>
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                  <option value="Finance">Finance</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
