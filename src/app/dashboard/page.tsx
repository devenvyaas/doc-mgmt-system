'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Profile, Document } from '@/lib/types';
import {
  FileText,
  UploadCloud,
  Zap,
  Search,
  Filter,
  Download,
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
} from 'lucide-react';

export default function UserDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState<boolean>(false);

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('General');

  const supabase = createClient();

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
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

      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false });

      if (isMounted) {
        if (prof) setProfile(prof as Profile);
        if (docs) setDocuments(docs as Document[]);
        setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const refreshDashboard = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('uploaded_by', user.id)
      .order('created_at', { ascending: false });

    if (prof) setProfile(prof as Profile);
    if (docs) setDocuments(docs as Document[]);
  }, [supabase]);

  // Handle Stripe Checkout Upgrade
  async function handleUpgrade() {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate checkout');
      }
    } catch {
      alert('Error redirecting to Stripe Checkout');
    } finally {
      setStripeLoading(false);
    }
  }

  // Handle Upload
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) {
      setUploadError('Please select a file and enter a title');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed');
      } else {
        setUploadSuccess('Document uploaded successfully!');
        setFile(null);
        setTitle('');
        setDescription('');
        setCategory('General');
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(null);
        }, 1200);
        refreshDashboard();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during upload';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }

  // Handle Download
  async function handleDownload(doc: Document) {
    setDownloadingId(doc.id);
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Failed to download file');
      }
    } catch {
      alert('Download error occurred');
    } finally {
      setDownloadingId(null);
    }
  }

  // Handle Delete
  async function handleDelete(docId: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } else {
        alert(data.error || 'Failed to delete document');
      }
    } catch {
      alert('Delete error occurred');
    } finally {
      setDeletingId(null);
    }
  }

  // Filter Documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'General', 'Work', 'Personal', 'Finance', 'Legal'];

  const isPro = profile?.subscription_tier === 'pro';
  const totalUploaded = documents.length;
  const remainingUploads = isPro ? 'Unlimited' : Math.max(0, 5 - totalUploaded);
  const maxMb = isPro ? 100 : 10;

  function getFileIcon(type: string) {
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-400" />;
    if (type.includes('word') || type.includes('document'))
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar profile={profile} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Title & Upload Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              My Document Vault
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload, organize, and manage your secure documents.
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Dashboard Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stat 1: Total Uploaded */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Uploaded
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">{totalUploaded}</h2>
              <p className="text-xs text-slate-500 mt-1">Stored documents</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Stat 2: Current Subscription */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Subscription Plan
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-bold text-white capitalize">
                  {profile?.subscription_tier || 'Free'} Plan
                </span>
                {isPro && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PRO
                  </span>
                )}
              </div>
              {!isPro && (
                <button
                  onClick={handleUpgrade}
                  disabled={stripeLoading}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition"
                >
                  {stripeLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 fill-amber-400" />
                  )}
                  Upgrade to Pro ($19/mo)
                </button>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
          </div>

          {/* Stat 3: Remaining Limit */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Remaining Upload Limit
              </p>
              <h2 className="text-3xl font-bold text-white mt-2">
                {remainingUploads}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Max file size: <span className="text-slate-300 font-semibold">{maxMb} MB</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UploadCloud className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Filter */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Documents Table / Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading your document vault...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-20 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300">No documents found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {searchQuery || selectedCategory !== 'All'
                ? 'No documents match your active search filter.'
                : 'You have not uploaded any documents yet. Click Upload Document to get started.'}
            </p>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Document</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">File Size</th>
                    <th className="px-6 py-4">Uploaded Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                            {getFileIcon(doc.file_type)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 group-hover:text-indigo-400 transition">
                              {doc.title}
                            </p>
                            {doc.description && (
                              <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                          {doc.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                        {formatBytes(doc.file_size)}
                      </td>

                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-700/60 transition"
                            title="Download Document"
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={deletingId === doc.id}
                            className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/60 transition"
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
          </div>
        )}
      </main>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Upload New Document</h2>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Input Drag and Drop */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Document File (PDF, DOCX, Images - Max {maxMb}MB)
                </label>
                <div className="relative border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 text-center cursor-pointer transition bg-slate-950/50">
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                        if (!title) {
                          setTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-400 text-sm font-medium">
                      <FileCheck className="w-5 h-5" />
                      <span className="truncate max-w-xs">{file.name}</span>
                      <span className="text-xs text-slate-500">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-400">
                        Click or drag file to upload
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Allowed: PDF, DOCX, PNG, JPG, WEBP
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Document Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="General">General</option>
                  <option value="Work">Work</option>
                  <option value="Personal">Personal</option>
                  <option value="Finance">Finance</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-medium flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload File</span>
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
