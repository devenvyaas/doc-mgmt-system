'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { getOrEnsureProfile } from '@/lib/supabase/profile';
import { Profile, Document } from '@/lib/types';
import {
  FileText,
  UploadCloud,
  Zap,
  Search,
  Filter,
  Download,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  X,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  File,
  FileCode,
  Image as ImageIcon,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function UserDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchingDocs, setFetchingDocs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Pagination State (10 items per page)
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 10;

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('General');
  const [updating, setUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Action States
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState<boolean>(false);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('General');

  const supabase = createClient();

  // Load User Profile on Mount
  useEffect(() => {
    let isMounted = true;
    async function loadUserData() {
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

      if (isMounted) {
        if (prof) setProfile(prof);
        setLoading(false);
      }
    }
    loadUserData();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Server-side Search, Category Filtering & 10-item Pagination API Fetch
  const fetchDocuments = useCallback(async (search: string, cat: string, pageNum: number) => {
    setFetchingDocs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pageNum.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (cat && cat !== 'All') params.set('category', cat);

      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.documents) {
        setDocuments(data.documents);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('Failed to fetch documents from server API:', data.error);
      }
    } catch (err) {
      console.error('Error fetching documents from server API:', err);
    } finally {
      setFetchingDocs(false);
    }
  }, []);

  // Fetch documents whenever search, category, or page changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments(searchQuery, selectedCategory, page);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, page, fetchDocuments]);

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const prof = await getOrEnsureProfile(
      supabase,
      user.id,
      user.email || '',
      user.user_metadata?.full_name
    );

    if (prof) setProfile(prof);
  }, [supabase]);

  // Handle Document Upload
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim() || file.name);
    formData.append('description', description.trim());
    formData.append('category', category);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadError(data.error || 'Upload failed');
      } else {
        setUploadSuccess('Document uploaded successfully!');
        setFile(null);
        setTitle('');
        setDescription('');
        setCategory('General');
        fetchDocuments(searchQuery, selectedCategory, page);
        refreshProfile();

        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(null);
        }, 1200);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  // Handle Document Details Update (PATCH)
  async function handleUpdateDocument(e: React.FormEvent) {
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
        fetchDocuments(searchQuery, selectedCategory, page);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  // Open Document in New Tab (View Mode) or Direct Download (Download Mode)
  async function handleDocumentAction(docId: string, mode: 'view' | 'download') {
    const actionKey = `${docId}-${mode}`;
    setActionState(actionKey);
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
      setActionState(null);
    }
  }

  // Handle Document Deletion
  async function handleDelete(docId: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchDocuments(searchQuery, selectedCategory, page);
        refreshProfile();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch {
      alert('Error deleting document');
    } finally {
      setDeletingId(null);
    }
  }

  // Handle Stripe Upgrade
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
  const remainingLimit = isPro ? 'Unlimited' : Math.max(0, 5 - totalCount);
  const isUploadDisabled = !isPro && totalCount >= 5;

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

  const startRange = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, totalCount);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome & Upload Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              My Document Vault
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload, organize, search, and manage your secure documents.
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            disabled={isUploadDisabled}
            className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg transition shrink-0 ${
              isUploadDisabled
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/25'
            }`}
          >
            <Plus className="w-5 h-5" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Dashboard Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Uploads */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Uploaded
              </p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{totalCount}</h3>
              <p className="text-xs text-slate-500 mt-1">Stored documents</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Subscription Plan */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Subscription Plan
              </p>

              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-3xl font-extrabold text-white">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </h3>
                {isPro && <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />}
              </div>

              {!isPro && (
                <button
                  onClick={handleUpgrade}
                  disabled={stripeLoading}
                  className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  {stripeLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  <span>Upgrade to Pro ($19/mo)</span>
                </button>
              )}
            </div>

            <div
              className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                isPro
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Zap className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Upload Limit */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Remaining Upload Limit
              </p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{remainingLimit}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Max file size: {isPro ? '100 MB' : '10 MB'}
              </p>
            </div>

            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UploadCloud className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Server-Side API Search & Category Filter Bar */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
            {['All', 'General', 'Work', 'Personal', 'Finance', 'Legal'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Documents Vault Table / Grid */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden min-h-[250px] flex flex-col justify-between">
          {loading || fetchingDocs ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">Fetching document vault...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
                <FolderOpen className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-300">No documents found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || selectedCategory !== 'All'
                  ? 'No documents match your server search query or filter.'
                  : 'You have not uploaded any documents yet. Click Upload Document to get started.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Document</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">File Size</th>
                      <th className="px-6 py-4">Uploaded</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {documents.map((doc) => (
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

                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {doc.category}
                          </span>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          {formatBytes(doc.file_size)}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Dedicated View Button (Eye Icon - Opens Inline in New Tab) */}
                            <button
                              onClick={() => handleDocumentAction(doc.id, 'view')}
                              disabled={actionState === `${doc.id}-view`}
                              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-700 hover:border-indigo-500/30 transition disabled:opacity-50"
                              title="View Document in New Tab"
                            >
                              {actionState === `${doc.id}-view` ? (
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>

                            {/* Dedicated Download Button (Exact DB Title Filename) */}
                            <button
                              onClick={() => handleDocumentAction(doc.id, 'download')}
                              disabled={actionState === `${doc.id}-download`}
                              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 border border-slate-700 hover:border-blue-500/30 transition disabled:opacity-50"
                              title="Download Document"
                            >
                              {actionState === `${doc.id}-download` ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>

                            {/* Edit Details Button (Pencil Icon) */}
                            <button
                              onClick={() => {
                                setEditingDoc(doc);
                                setEditTitle(doc.title);
                                setEditDescription(doc.description || '');
                                setEditCategory(doc.category || 'General');
                              }}
                              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 border border-slate-700 hover:border-amber-500/30 transition"
                              title="Edit Document Details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDelete(doc.id)}
                              disabled={deletingId === doc.id}
                              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 transition"
                              title="Delete Document"
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-Side Pagination Bar (10 documents per page) */}
              <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Showing <span className="font-semibold text-slate-200">{startRange}</span> -{' '}
                  <span className="font-semibold text-slate-200">{endRange}</span> of{' '}
                  <span className="font-semibold text-slate-200">{totalCount}</span> documents
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 rounded-lg bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 font-medium">
                    Page {page} of {totalPages || 1}
                  </span>

                  <button
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
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
      </main>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
                Upload New Document
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Select File (PDF, DOCX, Images)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,image/*"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setFile(selected);
                    if (selected && !title) {
                      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-slate-950 border border-slate-800 rounded-xl cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Limit: {isPro ? '100 MB per file (Pro)' : '10 MB per file (Free)'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quarterly Financial Summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of document content..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
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
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Start Upload</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Document Details Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                Edit Document Details
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

            <form onSubmit={handleUpdateDocument} className="space-y-4">
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
