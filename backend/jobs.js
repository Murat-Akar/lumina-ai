'use strict';

// In-memory job store. Jobs expire after 2 hours.
const store = new Map();
const TTL_MS = 2 * 60 * 60 * 1000;

module.exports = {
  create(jobId, totalImages) {
    store.set(jobId, {
      jobId,
      status: 'processing',   // 'processing' | 'done' | 'failed'
      progress: 0,            // 0-100
      totalImages,
      completedImages: 0,
      images: [],             // populated on completion
      error: null,
      createdAt: Date.now(),
    });
    setTimeout(() => store.delete(jobId), TTL_MS);
  },

  get(jobId) {
    return store.get(jobId) || null;
  },

  // Call each time a slot finishes (thread-safe in single-threaded Node)
  addCompleted(jobId) {
    const job = store.get(jobId);
    if (!job) return;
    job.completedImages += 1;
    // Cap at 90 while still processing; complete() sets it to 100
    job.progress = Math.min(90, Math.round((job.completedImages / job.totalImages) * 90));
  },

  complete(jobId, images) {
    const job = store.get(jobId);
    if (!job) return;
    job.status = 'done';
    job.progress = 100;
    job.completedImages = job.totalImages;
    job.images = images;
  },

  fail(jobId, errorMessage) {
    const job = store.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.error = errorMessage;
  },

  // Returns the most recently completed job (for recovery when jobId is lost)
  getLatest() {
    let latest = null;
    for (const job of store.values()) {
      if (job.status === 'done') {
        if (!latest || job.createdAt > latest.createdAt) latest = job;
      }
    }
    return latest;
  },
};
