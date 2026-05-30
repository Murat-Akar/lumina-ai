# Lumina AI — Amazon Listing Image Generator

Turn any product photo into a high-converting Amazon listing image in minutes.

## Overview

Lumina AI analyzes top-performing competitor listing images and recreates that winning style with your own product — entirely original, never copied. The platform combines a guided multi-step frontend with a custom Node.js backend that orchestrates image generation via the OpenAI API.

## How It Works

1. **Upload** — Drop your raw product photos (any background, any lighting)
2. **Describe** — Provide product details: materials, dimensions, target audience, key selling points
3. **Reference** — Add up to 8 competitor listing images as style references
4. **Generate** — Receive unique, ready-to-upload listing images with per-image retry and version history

## Features

- **Competitor Intelligence** — Style, lighting, and composition extracted from competitor references; applied to your product
- **Up to 8 images per session** — One generated image per competitor reference
- **Retry with feedback** — Regenerate individual images; browse previous versions inline
- **100% original output** — No plagiarism; each image is newly generated from your product and the analyzed style
- **~3 min per session** — From upload to download

## Tech Stack

**Frontend**
- HTML5 / CSS3 / Vanilla JavaScript
- Tailwind CSS
- Material Symbols

**Backend**
- Node.js + Express
- OpenAI API (image generation)
- Multer (multipart file handling)
- UUID (session management)

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key

### Setup

```bash
git clone https://github.com/Murat-Akar/lumina-ai.git
cd lumina-ai/backend

npm install

cp .env.example .env
# Set OPENAI_API_KEY in .env

npm start
```

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

## Project Structure

```
lumina-ai/
├── index.html            # Landing page
├── login.html            # Authentication
├── wizard-step1.html     # Step 1: Upload photos
├── wizard-step3.html     # Step 3: Results & download
├── auth.js               # Auth logic
├── config.js             # Frontend configuration
├── style.css             # Global styles
└── backend/
    ├── server.js         # Express API server
    ├── package.json
    └── .env.example
```

## License

© 2025 Lumina AI Technologies. All rights reserved.
