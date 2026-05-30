'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');

const jobs                      = require('./jobs');
const { processJob, retrySlot } = require('./pipeline');

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: true })); // allow file:// (null origin) and all domains
app.use(express.json());

// Health check
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'Lumina AI Backend' }));

// POST /generate — accepts product_image, product_info, competitor_image_0..N
app.post('/generate', upload.any(), (req, res) => {
  const productFile     = (req.files || []).find(f => f.fieldname === 'product_image');
  const competitorFiles = (req.files || [])
    .filter(f => f.fieldname.startsWith('competitor_image_'))
    .sort((a, b) => {
      const na = parseInt(a.fieldname.replace('competitor_image_', ''), 10);
      const nb = parseInt(b.fieldname.replace('competitor_image_', ''), 10);
      return na - nb;
    });
  const productInfo = (req.body && req.body.product_info) ? req.body.product_info.trim() : '';

  if (!productFile)           return res.status(400).json({ error: 'Missing product_image' });
  if (!competitorFiles.length) return res.status(400).json({ error: 'Missing competitor_image_N files' });
  if (!productInfo)           return res.status(400).json({ error: 'Missing product_info text' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });

  const jobId = uuidv4();
  jobs.create(jobId, competitorFiles.length);

  // Fire-and-forget: process runs async, frontend polls for status
  processJob(jobId, productFile, competitorFiles, productInfo)
    .catch(err => jobs.fail(jobId, err.message));

  res.json({ jobId, status: 'processing', totalImages: competitorFiles.length });
});

// GET /status/:jobId — returns job status + progress + images when done
app.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json(job);
});

// GET /latest-job — returns most recently completed job (recovery endpoint)
app.get('/latest-job', (_req, res) => {
  const job = jobs.getLatest();
  if (!job) return res.status(404).json({ error: 'No completed jobs found' });
  res.json(job);
});

// POST /retry-slot — re-run Stage 5 for one slot with optional user feedback
app.post('/retry-slot', express.json(), async (req, res) => {
  const { jobId, slot, feedback } = req.body || {};
  if (!slot) return res.status(400).json({ error: 'slot is required' });

  const job = jobId ? jobs.get(jobId) : jobs.getLatest();
  if (!job || job.status !== 'done')
    return res.status(404).json({ error: 'Job not found or not completed yet' });

  const slotData = job.images.find(img => img.slot === Number(slot));
  if (!slotData)
    return res.status(404).json({ error: `Slot ${slot} not found in job` });
  if (!slotData.productData || !slotData.stage2Brief)
    return res.status(400).json({ error: 'This image was generated before retry support was added. Please run a new generation.' });

  try {
    const newImageData = await retrySlot(
      slotData.data,
      slotData.productData,
      slotData.stage2Brief,
      feedback || ''
    );
    slotData.data = newImageData; // update stored image for future retries
    res.json({ success: true, imageData: newImageData, filename: slotData.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lumina AI backend listening on port ${PORT}`));
