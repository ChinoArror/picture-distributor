'use client';

import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';
import React, { FormEvent, startTransition, useDeferredValue, useEffect, useState } from 'react';

type UploadedPhoto = {
  id: string;
  originalName?: string;
  name?: string;
  url?: string;
  contentType?: string;
  sizeBytes?: number;
};

type SearchResponse = {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  matchCount: number;
  matchedPhotoIds: string[];
  matchedUrls: string[];
  results: UploadedPhoto[];
  error?: string | null;
  completedAt?: string | null;
};

const cardTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

const staggerParent = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const staggerChild = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: cardTransition },
};

const API_BASE = '';

export default function App() {
  const [adminFiles, setAdminFiles] = useState<File[]>([]);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [task, setTask] = useState<SearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deferredResults = useDeferredValue(task?.results ?? []);

  useEffect(() => {
    if (!selfieFile) {
      setSelfiePreview(null);
      return;
    }

    const preview = URL.createObjectURL(selfieFile);
    setSelfiePreview(preview);

    return () => URL.revokeObjectURL(preview);
  }, [selfieFile]);

  useEffect(() => {
    if (!task?.taskId || !['pending', 'processing'].includes(task.status)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const next = await fetchJson<SearchResponse>(`${API_BASE}/api/status/${task.taskId}`);
        startTransition(() => {
          setTask(next);
          if (next.status === 'completed' || next.status === 'failed') {
            setSearching(false);
          }
        });
      } catch (error) {
        setSearching(false);
        setErrorMessage(asMessage(error));
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [task?.taskId, task?.status]);

  const selectedResults = deferredResults.filter((photo) => selectedIds.includes(photo.id));

  async function handleAdminUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminFiles.length) {
      setErrorMessage('Choose one or more photos to send into the ingest queue.');
      return;
    }

    setErrorMessage(null);
    setUploading(true);

    try {
      const formData = new FormData();
      adminFiles.forEach((file) => formData.append('photos', file));

      const response = await fetchJson<{ uploaded: number }>(`${API_BASE}/api/admin/photos`, {
        method: 'POST',
        body: formData,
      });

      setUploadedCount((count) => count + response.uploaded);
      setAdminFiles([]);
    } catch (error) {
      setErrorMessage(asMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selfieFile) {
      setErrorMessage('Upload a selfie before starting the face scan.');
      return;
    }

    setErrorMessage(null);
    setSearching(true);
    setTask(null);
    setSelectedIds([]);
    setSelectMode(false);

    try {
      const formData = new FormData();
      formData.append('selfie', selfieFile);

      const response = await fetchJson<{ taskId: string; status: 'pending' | 'processing' }>(
        `${API_BASE}/api/search`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setTask({
        taskId: response.taskId,
        status: response.status,
        matchCount: 0,
        matchedPhotoIds: [],
        matchedUrls: [],
        results: [],
      });
    } catch (error) {
      setSearching(false);
      setErrorMessage(asMessage(error));
    }
  }

  async function handleDownloadSelected() {
    if (!selectedResults.length) {
      return;
    }

    setDownloadBusy(true);
    setErrorMessage(null);

    try {
      const zip = new JSZip();

      for (const photo of selectedResults) {
        if (!photo.url) continue;
        const response = await fetch(photo.url);
        if (!response.ok) {
          throw new Error(`Failed to download ${photo.name ?? photo.id}`);
        }

        const blob = await response.blob();
        zip.file(photo.name || `${photo.id}.jpg`, blob);
      }

      const archive = await zip.generateAsync({
        type: 'blob',
        streamFiles: true,
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const href = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `photofinder-selection-${Date.now()}.zip`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setErrorMessage(asMessage(error));
    } finally {
      setDownloadBusy(false);
    }
  }

  function toggleSelection(photoId: string) {
    if (!selectMode) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId]
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe8] text-slate-900">
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(255,255,255,0.98), transparent 38%), radial-gradient(circle at 85% 15%, rgba(250,211,167,0.55), transparent 24%), linear-gradient(135deg, #f7f2eb 0%, #efe1d1 48%, #ead8c5 100%)',
        }}
      />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-6 md:px-8 lg:px-10">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cardTransition}
          className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_80px_rgba(99,69,32,0.14)] backdrop-blur-xl md:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-amber-700/75">
                PhotoFinder
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl">
                Queue-first photo distribution with a polished face-match flow.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                Admins upload event galleries into the ingest queue, users scan once, and the gallery arrives
                with a soft Apple-style reveal over a Material 3 inspired interface.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Queued Uploads" value={String(uploadedCount)} />
              <MetricCard label="Scan Status" value={task?.status ?? 'idle'} />
              <MetricCard label="Matches" value={String(task?.matchCount ?? 0)} />
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cardTransition, delay: 0.05 }}
            onSubmit={handleAdminUpload}
            className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_70px_rgba(99,69,32,0.12)] backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Admin ingestion</h2>
                <p className="mt-2 text-sm text-slate-600">Upload a batch to R2, create `photos` rows, and fan out to `ingest-queue`.</p>
              </div>
              <div className="rounded-full bg-amber-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-amber-800">
                Multi-file
              </div>
            </div>

            <label className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-amber-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(251,243,233,0.95))] p-6 text-center transition hover:border-amber-500 hover:shadow-[0_16px_40px_rgba(180,126,63,0.12)]">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(event) => setAdminFiles(Array.from(event.target.files ?? []))}
              />
              <div className="rounded-full bg-slate-950 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white">
                Choose photos
              </div>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-600">
                Drag in a full event batch. Each file is written to R2 and immediately scheduled for asynchronous face indexing.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-800">
                {adminFiles.length ? `${adminFiles.length} file(s) ready` : 'No files selected yet'}
              </p>
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              {adminFiles.slice(0, 6).map((file) => (
                <span key={`${file.name}-${file.lastModified}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {file.name}
                </span>
              ))}
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white shadow-[0_14px_32px_rgba(15,23,42,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading to queue...' : 'Start ingest pipeline'}
            </button>
          </motion.form>

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...cardTransition, delay: 0.1 }}
            onSubmit={handleSearch}
            className="rounded-[2rem] border border-white/10 bg-[#101826] p-6 text-white shadow-[0_20px_70px_rgba(16,24,38,0.35)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">User distribution</h2>
                <p className="mt-2 text-sm text-slate-300">Upload one selfie, return a `task_id`, and let the queue finish the heavy work.</p>
              </div>
              <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-200">
                Async scan
              </div>
            </div>

            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(event) => setSelfieFile(event.target.files?.[0] ?? null)}
              />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_35%),linear-gradient(180deg,#121a2b_0%,#0d1320_100%)] p-5">
                <AnimatePresence mode="wait">
                  {selfiePreview ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="relative mx-auto aspect-[4/5] max-w-sm overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-900"
                    >
                      <img src={selfiePreview} alt="Selfie preview" className="h-full w-full object-cover" />
                      {searching && <ScanningOverlay />}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex aspect-[4/5] max-w-sm flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-cyan-300/30 bg-white/5 text-center"
                    >
                      <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100">
                        Scan Face
                      </div>
                      <p className="mt-5 max-w-xs text-sm leading-6 text-slate-300">
                        Add a close selfie and we will create a search task instantly while the queue processes matches.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </label>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!selfieFile || searching}
                className="inline-flex items-center justify-center rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_36px_rgba(34,211,238,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? 'Scanning in queue...' : 'Start face scan'}
              </button>
              {task?.taskId && <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Task {task.taskId.slice(0, 8)}</span>}
            </div>
          </motion.form>
        </section>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700"
          >
            {errorMessage}
          </motion.div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...cardTransition, delay: 0.15 }}
          className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_20px_70px_rgba(99,69,32,0.12)] backdrop-blur-xl"
        >
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">Matched gallery</h2>
              <p className="mt-2 text-sm text-slate-600">
                Masonry layout, staggered reveal, and a dedicated select mode for bulk download.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!deferredResults.length}
                onClick={() => {
                  setSelectMode((value) => !value);
                  if (selectMode) setSelectedIds([]);
                }}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {selectMode ? 'Exit select mode' : 'Select mode'}
              </button>

              {selectMode && !!deferredResults.length && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds((current) =>
                      current.length === deferredResults.length ? [] : deferredResults.map((photo) => photo.id)
                    )
                  }
                  className="rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-900"
                >
                  {selectedIds.length === deferredResults.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {searching && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-[1.6rem] border border-cyan-200/60 bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(224,242,254,0.65))] p-6"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white">
                    <motion.div
                      animate={{ scale: [1, 1.16, 1], opacity: [0.35, 0.12, 0.35] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full border-2 border-cyan-400"
                    />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-3 rounded-full border border-dashed border-cyan-500/80"
                    />
                    <div className="h-3 w-3 rounded-full bg-cyan-500 shadow-[0_0_24px_rgba(34,211,238,0.85)]" />
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.35em] text-cyan-700">Face scanning</p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      The search queue is matching faces and preparing your gallery.
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                      We return the task immediately, then poll every 2 seconds until the worker marks the task as completed.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {!searching && task?.status === 'failed' && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6 text-rose-800"
              >
                {task.error || 'The search task failed before any matches were returned.'}
              </motion.div>
            )}

            {!searching && task?.status === 'completed' && !deferredResults.length && (
              <motion.div
                key="empty-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-10 text-center text-slate-600"
              >
                No matching photos were found for this selfie.
              </motion.div>
            )}

            {!searching && !!deferredResults.length && (
              <motion.div
                key="gallery"
                variants={staggerParent}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0 }}
                className="columns-1 gap-4 md:columns-2 xl:columns-3"
              >
                {deferredResults.map((photo) => {
                  const active = selectedIds.includes(photo.id);

                  return (
                    <motion.button
                      key={photo.id}
                      type="button"
                      variants={staggerChild}
                      onClick={() => toggleSelection(photo.id)}
                      className={`group relative mb-4 block w-full overflow-hidden rounded-[1.75rem] border bg-white text-left transition ${
                        active ? 'border-cyan-500 shadow-[0_16px_44px_rgba(34,211,238,0.24)]' : 'border-white/70 shadow-[0_16px_44px_rgba(99,69,32,0.12)]'
                      } ${selectMode ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.name ?? photo.id}
                          className="w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{photo.name ?? photo.id}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500">
                            {(photo.contentType ?? 'image').replace('image/', '')}
                          </p>
                        </div>

                        {selectMode && (
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                              active
                                ? 'border-cyan-500 bg-cyan-500 text-white'
                                : 'border-slate-300 bg-white text-slate-500'
                            }`}
                          >
                            {active ? 'X' : ''}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </main>

      <AnimatePresence>
        {selectMode && !!selectedIds.length && (
          <motion.button
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={cardTransition}
            onClick={handleDownloadSelected}
            disabled={downloadBusy}
            className="fixed bottom-6 right-6 z-20 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-[0_22px_48px_rgba(15,23,42,0.32)]"
          >
            {downloadBusy ? 'Preparing zip...' : `Download selected (${selectedIds.length})`}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/90 p-4">
      <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
    </div>
  );
}

function ScanningOverlay() {
  return (
    <>
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.38, 0.18] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-6 rounded-[1.25rem] border border-cyan-300/60"
      />
      <motion.div
        animate={{ y: ['0%', '100%', '0%'] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(34,211,238,0)_0%,rgba(34,211,238,0.35)_50%,rgba(34,211,238,0)_100%)]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_52%)]" />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/70 px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-cyan-100 backdrop-blur">
        Matching faces
      </div>
    </>
  );
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
}

function asMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}
