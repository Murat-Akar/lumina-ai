# Lumina AI — Amazon Listing Image Generator

Turn any product photo into a high-converting Amazon listing image in minutes.

## What It Does

Lumina AI analyzes your competitors' best-performing listing images and recreates that winning style with your own product — entirely original, never copied.

**Workflow:**
1. Upload your raw product photos (any background, any lighting)
2. Describe your product — materials, dimensions, target audience
3. Add up to 8 competitor listing images as style references
4. Receive unique, ready-to-upload listing images with retry & history

## Features

- **Competitor Intelligence** — Learns from top-performing listings, applies that style to yours
- **Up to 8 images per session** — One per competitor reference
- **Retry with feedback** — Not happy? Retry individual images and browse version history
- **100% Plagiarism-Free** — Same winning strategy, completely new design
- **~3 min per session** — Fast turnaround from upload to download

## Pricing

| Plan | Price | Details |
|------|-------|---------|
| Starter | Free | 1 session · 4 competitor images · 1 retry per image |
| Pro | $20 / run | 8 competitor images · 3 retries · priority processing · high-res downloads |

## Tech Stack

**Frontend**
- Vanilla HTML/CSS/JS
- Tailwind CSS (CDN)
- Material Symbols

**Backend**
- Node.js + Express
- OpenAI API (image generation)
- Multer (file uploads)
- n8n (workflow automation)

## Getting Started

### Prerequisites
- Node.js 18+
- OpenAI API key

### Setup

```bash
# Clone the repo
git clone https://github.com/Murat-Akar/lumina-ai.git
cd lumina-ai

# Install backend dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Add your OpenAI API key to .env

# Start the backend
npm start
```

Open `index.html` in your browser or serve the root folder with any static file server.

### Environment Variables

```
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

## Project Structure

```
lumina-ai/
├── index.html          # Landing page
├── login.html          # Auth page
├── wizard-step1.html   # Upload photos
├── wizard-step3.html   # Results & download
├── auth.js             # Authentication logic
├── config.js           # Frontend config
├── style.css           # Global styles
├── n8n-workflow.json   # n8n automation workflow
└── backend/
    ├── server.js       # Express server
    ├── package.json
    └── .env.example
```

## License

© 2025 Lumina AI Technologies. All rights reserved.
