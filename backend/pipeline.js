'use strict';

const axios    = require('axios');
const FormData = require('form-data');
const jobs     = require('./jobs');

const RESPONSES_URL   = 'https://api.openai.com/v1/responses';
const IMAGE_EDITS_URL = 'https://api.openai.com/v1/images/edits';
const ANALYSIS_MODEL  = 'gpt-5.5';
const GEN_MODEL       = 'gpt-image-2';

// ─── Helpers ────────────────────────────────────────────────────────────────

function bufToDataUrl(buf, mime = 'image/jpeg') {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim())
    return data.output_text.trim();

  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;
      for (const c of item.content) {
        if (['output_text', 'text'].includes(c.type) && typeof c.text === 'string')
          parts.push(c.text);
      }
    }
    if (parts.length) return parts.join('\n').trim();
  }

  throw new Error(
    'Cannot extract text from OpenAI response: ' + JSON.stringify(data).slice(0, 400)
  );
}

function findB64(obj) {
  if (!obj || typeof obj === 'string') return null;
  if (obj.b64_json) return obj.b64_json;
  if (Array.isArray(obj)) {
    for (const x of obj) { const r = findB64(x); if (r) return r; }
  } else if (typeof obj === 'object') {
    for (const v of Object.values(obj)) { const r = findB64(v); if (r) return r; }
  }
  return null;
}

// ─── OpenAI callers ──────────────────────────────────────────────────────────

async function callAnalysis(inputMessages) {
  const { data } = await axios.post(
    RESPONSES_URL,
    {
      model: ANALYSIS_MODEL,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
      input: inputMessages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5 * 60 * 1000,
    }
  );
  return extractText(data);
}

async function callImageGen(prompt, buffers, filenames) {
  const form = new FormData();
  form.append('model',   GEN_MODEL);
  form.append('prompt',  prompt);
  form.append('size',    '1024x1024');
  form.append('quality', 'medium');

  buffers.forEach((buf, i) =>
    form.append('image[]', buf, {
      filename:    filenames[i] || `image_${i}.jpg`,
      contentType: 'image/jpeg',
    })
  );

  const { data } = await axios.post(IMAGE_EDITS_URL, form, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    timeout:          8 * 60 * 1000,
    maxBodyLength:    Infinity,
    maxContentLength: Infinity,
  });

  const b64 = findB64(data);
  if (!b64)
    throw new Error('No b64_json in image generation response: ' + JSON.stringify(data).slice(0, 400));

  return Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
}

// ─── Stage Prompts ───────────────────────────────────────────────────────────

const STAGE_1_PROMPT = `
Analyze the competitor listing image and compare it against the Product Info document.

Your goal is to identify the competitor image's REAL communication strategy,
then adapt that strategy safely using only supported product information.

The competitor image defines:
- the communication topic
- the buyer takeaway
- the visual storytelling direction

Product Info defines:
- factual correctness
- supported capabilities
- supported implementations
- supported claims

Do not invent new marketing angles that are not central to the competitor image.
Do not oversimplify the competitor image into a generic product-category message.

Distinguish between:
- the surface-level product topic
vs
- the deeper buyer-facing communication strategy.

A travel-themed image may actually communicate:
- multi-scenario versatility
- lifestyle flexibility
- portability
- family usage
- outdoor readiness
- convenience

Do not collapse multiple distinct buyer scenarios into a single generic concept unless
the competitor image itself is visually simple and singularly focused.

Identify:
- the main communication strategy
- the core buyer takeaway
- the key visual priorities
- the information hierarchy
- the storytelling structure
- the features being emphasized
- unsupported claims/features
- the closest supported replacements from Product Info

Core Communication Focus ->
Identify the SINGLE most important communication goal of the competitor image.

Then identify:
- which supported product capabilities are ESSENTIAL to that message
- which supported capabilities should be EXCLUDED because they are unrelated

Communication-Relevant Supported Features ->
Identify ONLY the supported product capabilities from Product Info that are:
- fully supported
- visually communicable
- directly relevant to the competitor image's core communication goal

A supported feature does NOT automatically belong in the image.

If a supported capability is not important to the competitor image's main message,
exclude it completely.

Do NOT treat all supported product capabilities as equally important.

When the competitor image communicates a feature category,
Product Info determines the correct counts, names, variants, supported limitations.

For unsupported, incomplete, or incorrect competitor claims,
clearly identify the closest supported Product Info replacement.

Clearly identify which visual elements are ESSENTIAL to the core communication goal.
Also identify which accessories, packaging, secondary objects are NON-ESSENTIAL.

Keep the response structured, concise, and practical.
Return the response as markdown text only.
`.trim();

const STAGE_2_PROMPT = `
Using the real product photo, Product Info document, and competitor strategy analysis,
create a SAFE generation brief.

Focus only on:
- preserving real product accuracy
- preventing hallucinated physical details
- preventing unsupported claims/features
- preserving visible screen/icons if present
- keeping only the supported information directly relevant to the competitor image's PRIMARY communication goal

The competitor image defines the communication topic and structure.
Product Info defines the correct factual content.
Stage 1 defines the supported adaptation direction.

Do not infer hidden functionality from the competitor image.
Do NOT give layout, composition, or art direction instructions.

If a physical detail is unclear, represent it generically instead of inventing details.
Do not expose physical feature locations not clearly visible in the real product photo.

Only include supported product capabilities that are DIRECTLY important to the competitor image's main buyer takeaway.
A feature being supported does NOT mean it should appear in the image.

If the competitor image communicates through multiple buyer scenarios, multi-panel storytelling,
or lifestyle versatility — preserve that communication logic in the SAFE brief.

If the competitor image does NOT use communication text as a dominant visual element,
the SAFE brief must NOT include taglines, feature labels, specifications, or callouts.
In this case, explicitly instruct the generated image to remain text-free.

Unsupported specific use cases should be SAFELY REPLACED, not removed completely,
when they are central to the competitor image's communication structure.

Replace unsupported claims with broader supported contexts that preserve the same intent.

The SAFE brief should preserve the competitor image's communication richness when
that richness is central to the image strategy.

Accessories, packaging, cables, included-item displays should be excluded unless
ESSENTIAL to the competitor image's primary communication goal.

Keep the response short, practical, and specific.
Return markdown text only.
`.trim();

const STAGE_3_PROMPT = `
Use:
- the FIRST attached image as the competitor/reference image for communication strategy,
  customer takeaway, information hierarchy, and visual storytelling approach
- the SECOND attached image as the real product photo and ONLY source of truth for the product
- the SAFE Generation Brief as the factual execution guide

Create a premium Amazon listing image.

Preserve:
- product accuracy
- proportions
- materials
- screen/icons if present
- supported claims only

Understand the competitor image's communication goal,
but create an original visual execution.
Focus on communicating the same buyer takeaway, not recreating the same scene.

Do NOT closely mimic the competitor image's exact layout, composition, object placement,
or spatial structure.

Preserve the competitor image's communication architecture.
If the competitor image communicates through multiple use-case scenes, multi-panel storytelling,
lifestyle versatility, or layered educational structure — preserve that level of richness.

Do not collapse a multi-scenario competitor image into a single product beauty shot
or a generic portability poster.

Every major visual element should support the competitor image's PRIMARY communication goal.
Avoid adding unrelated supported features not important to the main buyer takeaway.

When the SAFE Generation Brief replaces unsupported claims with supported alternatives,
visually communicate the supported version instead.

Prioritize communication clarity over decorative visuals.

Preserve the competitor image's presentation category:
- If the competitor image is colorful, scenic, lifestyle-focused, visually rich —
  the generated image should preserve that atmosphere.
- If the competitor image uses plain white/near-white background with isolated product —
  the generated image must also use a plain white/near-white background.
  Do not introduce environmental scenery, lifestyle backgrounds, or atmospheric gradients.

STRICT TEXT RULE:
If the competitor image does NOT use communication text as a major part of the visual structure,
the generated image must remain text-free.
Small branding or packaging text does NOT count as permission to add feature labels or callouts.

Avoid:
- unsupported claims
- hallucinated physical details
- fake ports or mechanisms
- unsupported features
- unrelated secondary objects

Aspect ratio: 1:1
`.trim();

const STAGE_4_PROMPT = `
Look at the previous generated image.

Preserve:
- the communication goal
- the customer takeaway
- the important factual information
- the information density
- the storytelling depth

Do not preserve:
- the layout
- the composition
- the framing
- the visual flow
- the spatial structure

The redesign should feel like a different premium advertising designer created the image
from scratch while preserving the same buyer-facing message.

Preserve the MESSAGE, not the geometry.

If the image uses multiple scenarios, layered storytelling, educational structure,
or lifestyle contexts — preserve a comparable level of communication richness.

Do not simplify a rich image into a minimal advertisement unless the original is minimal.
Avoid small cosmetic changes.
The redesign should introduce a noticeably different visual execution at first glance.

Keep the redesign: premium, visually original, communication-first, commercially realistic.
Return markdown text only.
`.trim();

const STAGE_5_PROMPT = `
Use:
- the FIRST attached image as the previous generated image and communication reference
- the SECOND attached image as the real product photo and ONLY source of truth for the product
- the redesign direction as the creative guide

Create a more premium and visually distinct Amazon listing image.
The redesign should feel substantially different at first glance while preserving
the same buyer takeaway and communication richness.

Preserve:
- the core communication goal
- supported factual content
- important buyer-facing information
- information density
- storytelling depth

Do NOT remove, weaken, simplify, or omit important factual information from the previous image.
This includes: feature names, supported claims, labels, counts, specifications,
mode counts, important buyer-facing explanations.

Information and communication goals are LOCKED.

The redesign should instead change:
- layout structure
- composition flow
- framing strategy
- panel structure
- object placement
- spatial hierarchy
- visual rhythm
- presentation style

Preserve the MESSAGE, not the geometry.
Do not preserve the previous image's composition patterns, alignment logic,
panel arrangement, or framing structure.

If the previous image communicates multiple buyer scenarios, lifestyle contexts,
use-case diversity, layered information — preserve that communication richness.

Do not collapse a rich multi-context image into a simpler minimal advertisement
unless the previous image itself is minimal.

Use the real product photo for: product accuracy, proportions, materials, visible details.

Background & Visual Style ->
Preserve the previous image's overall presentation category.
- If clean/white/minimal: redesign stays clean/white/minimal.
- If colorful/scenic/lifestyle-rich: redesign preserves that richness.

Text Density Rules ->
If the previous image is text-free, the redesign must remain text-free.
Do not introduce infographic text, feature grids, badges, or extra labels
unless they already exist in the previous image.

Avoid:
- unsupported claims
- hallucinated physical details
- fake product features
- fake mechanisms
- clutter
- unrelated feature blocks
- packaging/pouch/cable/accessories unless ESSENTIAL

Keep the redesign: premium, visually original, clean, focused, communication-first.
Aspect ratio: 1:1
`.trim();

// ─── Process one competitor image slot through all 5 stages ─────────────────

async function processSlot(slotIndex, productBuf, competitorBuf, productInfoText, competitorName) {
  const productDataUrl    = bufToDataUrl(productBuf,    'image/jpeg');
  const competitorDataUrl = bufToDataUrl(competitorBuf, 'image/jpeg');

  // ── Stage 1: Competitor Strategy Analysis ──
  const stage1 = await callAnalysis([{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: [
          STAGE_1_PROMPT,
          '\n\n==============================',
          'PRODUCT INFO DOCUMENT',
          '(Source of truth for supported claims, specs, features, product behavior)',
          '==============================\n',
          productInfoText,
          '\n==============================',
          'FINAL STAGE 1 CHECK',
          'Analyze the competitor image strategy, then safely adapt using Product Info.',
          '==============================',
        ].join('\n'),
      },
      { type: 'input_image', image_url: competitorDataUrl },
    ],
  }]);

  // ── Stage 2: Safe Generation Brief ──
  const stage2 = await callAnalysis([{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: [
          STAGE_2_PROMPT,
          '\n\n==============================',
          'PRODUCT INFO DOCUMENT',
          '==============================\n',
          productInfoText,
          '\n==============================',
          'COMPETITOR STRATEGY ANALYSIS FROM STAGE 1',
          '==============================\n',
          stage1,
          '\n==============================',
          'FINAL SAFE BRIEF CHECK',
          '==============================',
        ].join('\n'),
      },
      { type: 'input_image', image_url: productDataUrl },
      { type: 'input_image', image_url: competitorDataUrl },
    ],
  }]);

  // ── Stage 3: First Image Generation ──
  // Competitor image first (reference), product second (source of truth)
  const stage3Prompt = [
    STAGE_3_PROMPT,
    '\n\n==============================',
    'SAFE GENERATION BRIEF FROM STAGE 2',
    '==============================\n',
    stage2,
    '\n==============================',
    'FINAL GENERATION CHECK',
    '==============================',
  ].join('\n');

  const stage3Buf = await callImageGen(
    stage3Prompt,
    [competitorBuf, productBuf],
    [competitorName || 'competitor.jpg', 'product.jpg']
  );

  // ── Stage 4: Design Difference Thinking ──
  const stage3DataUrl = bufToDataUrl(stage3Buf, 'image/png');

  const stage4 = await callAnalysis([{
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: [
          STAGE_4_PROMPT,
          '\n\n==============================',
          'SAFE GENERATION BRIEF FROM STAGE 2',
          '(Factual context only — use to avoid unsupported changes)',
          '==============================\n',
          stage2,
          '\n==============================',
          'FINAL STAGE 4 CHECK',
          '==============================',
        ].join('\n'),
      },
      { type: 'input_image', image_url: stage3DataUrl },
    ],
  }]);

  // ── Stage 5: Final Image Generation ──
  // Previous generated image first, product second
  const stage5Prompt = [
    STAGE_5_PROMPT,
    '\n\n==============================',
    'SAFE GENERATION BRIEF FROM STAGE 2',
    '==============================\n',
    stage2,
    '\n==============================',
    'REDESIGN DIRECTION FROM STAGE 4',
    '==============================\n',
    stage4,
    '\n==============================',
    'FINAL GENERATION CHECK',
    '==============================',
  ].join('\n');

  const finalBuf = await callImageGen(
    stage5Prompt,
    [stage3Buf, productBuf],
    ['stage3_generated.png', 'product.jpg']
  );

  return {
    slot:        slotIndex + 1,
    filename:    `generated_image_${slotIndex + 1}.png`,
    data:        `data:image/png;base64,${finalBuf.toString('base64')}`,
    productData: bufToDataUrl(productBuf),  // kept for retry
    stage2Brief: stage2,                    // kept for retry
  };
}

// ─── Retry a single slot with optional user feedback ─────────────────────────

async function retrySlot(currentImageData, productImageData, stage2Brief, userFeedback) {
  const previousBuf = Buffer.from(currentImageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const productBuf  = Buffer.from(productImageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  const feedbackSection = userFeedback
    ? [
        '\n\n==============================',
        'USER FEEDBACK FOR THIS RETRY',
        '==============================',
        userFeedback,
        '\nApply this feedback while preserving the communication goal and factual accuracy.',
      ].join('\n')
    : '';

  const prompt = [
    STAGE_5_PROMPT + feedbackSection,
    '\n\n==============================',
    'SAFE GENERATION BRIEF FROM STAGE 2',
    '==============================\n',
    stage2Brief,
    '\n==============================',
    'FINAL GENERATION CHECK',
    '==============================',
  ].join('\n');

  const finalBuf = await callImageGen(
    prompt,
    [previousBuf, productBuf],
    ['previous_generated.png', 'product.jpg']
  );

  return `data:image/png;base64,${finalBuf.toString('base64')}`;
}

// ─── Process entire job: all slots in parallel ───────────────────────────────

async function processJob(jobId, productFile, competitorFiles, productInfo) {
  const results = await Promise.allSettled(
    competitorFiles.map((cf, i) =>
      processSlot(i, productFile.buffer, cf.buffer, productInfo, cf.originalname)
        .then(result => {
          jobs.addCompleted(jobId);
          return result;
        })
    )
  );

  const images = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => a.slot - b.slot);

  if (!images.length) {
    const firstErr = results.find(r => r.status === 'rejected')?.reason?.message || 'All slots failed';
    throw new Error(firstErr);
  }

  jobs.complete(jobId, images);
}

module.exports = { processJob, retrySlot };
