# HaCha AI Fact Checker 🔍🤖

> **Real-time, privacy-first, RAG-assisted claim verification powered by Chrome Manifest V3, Node.js Gateway, Redis, and a Python AI microservice.**

---

## 📌 Overview

**HaCha AI Fact Checker** allows users to verify viral social media posts, headlines, articles, memes, or infographics directly within their web browser. Instead of scraping entire web pages automatically, HaCha lets users drag a selection box around any specific text or image region (`"Check this"` model), extracts text locally using **Tesseract.js (WebAssembly)** without uploading screen images to any server, and verifies the claim using a 3-tier cascade:

1. **Redis Cache** — Instant responses for previously verified viral claims using SHA-256 canonical hashing.
2. **Google Fact Check API** — Instant matches against existing authoritative fact-check databases.
3. **Python AI Service (RAG + LLM)** — Real-time web retrieval, evidence snippet ranking, and grounded LLM reasoning for novel claims.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. BROWSER EXTENSION (MV3)                              │
│                                                                                         │
│  User Activates ──► Region Selection Box ──► Local OCR (WASM) ──► Confirm Claim Text    │
│                                                                           │             │
│  Contextual Overlay Card ◄── Render Result ◄── Content Script ────────────┘             │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ POST /api/verify
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 2. NODE.JS EXPRESS GATEWAY                              │
│                                                                                         │
│  Validation & Rate Limiting ──► Claim Normalization ──► SHA-256 Claim Hash              │
│                                                               │                         │
│  Redis Cache (Tier 1) ◄────────────── HIT ────────────────────┤                         │
│         │ MISS                                                │                         │
│         ▼                                                     │                         │
│  Google Fact Check API (Tier 2) ───── MATCH ──────────────────┤                         │
│         │ NO MATCH                                            │                         │
│         ▼                                                     ▼                         │
│  Forward to Python AI Service ───────────────────────► Return Result                    │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             │ POST /verify
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                3. PYTHON AI MICROSERVICE                                │
│                                                                                         │
│  Query Generation ──► Search Retrieval ──► Boilerplate Removal ──► Snippet Ranking     │
│                                                                        │                │
│  Validated JSON Verdict ◄── LLM Reasoning ◄── Bounded RAG Context ─────┘                │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```text
HaCha/
├── extension/                 # Chrome Extension (Manifest V3, TypeScript, Shadow DOM UI)
│   ├── manifest.json          # Chrome MV3 manifest file
│   ├── src/                   # Extension source code (Background, Content, Popup, OCR)
│   └── package.json
├── backend/                   # Node.js Express Gateway & API Orchestrator
│   ├── src/                   # Validation, Normalization, Redis, Google FactCheck API
│   └── package.json
├── ai-service/                # Python FastAPI Microservice (Retrieval, RAG, LLM)
│   ├── app/                   # Query generator, web scraper, evidence ranker, RAG engine
│   └── requirements.txt
├── docker/                    # Docker Compose for local infrastructure (Redis + MongoDB)
│   └── docker-compose.yml
├── phase details/             # Detailed step-by-step guides for Phases 0 to 14
├── PROJECT_CONTEXT.md         # Master Architecture & Invariants Guide
└── HOW_TO_PREVIEW_EXTENSION.md# Beginner Guide for Previewing & Testing Chrome Extension
```

---

## 🚀 Quick Start & Development Setup

### Prerequisites
- **Node.js**: `v18+` or `v20+`
- **Python**: `3.10+`
- **Docker & Docker Desktop**: For running Redis & MongoDB locally
- **Google Chrome** (or Chromium-based browser like Edge/Brave/Vivaldi)

### 1. Spin up Local Infrastructure (Redis & MongoDB)
```bash
cd docker
docker-compose up -d
```

### 2. Start Node.js Express Gateway
```bash
cd backend
npm install
npm run dev
```
*Backend runs on `http://localhost:3000` (Health check: `http://localhost:3000/api/health`).*

### 3. Start Python AI Microservice
```bash
cd ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*AI service runs on `http://localhost:8000` (Health check: `http://localhost:8000/health`).*

---

## 🧩 Previewing & Testing the Extension

If you are new to Chrome Extension development, check our dedicated beginner's guide:
👉 **[HOW_TO_PREVIEW_EXTENSION.md](file:///c:/Users/CSE%20LAB%201/Downloads/HaCha/HOW_TO_PREVIEW_EXTENSION.md)**

### Quick Extension Preview Steps:
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Turn on **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension` directory inside this project.
5. Pin **HaCha AI** to your Chrome toolbar and test it on any webpage!

---

## 📚 Key Documentation

- **[PROJECT_CONTEXT.md](file:///c:/Users/CSE%20LAB%201/Downloads/HaCha/PROJECT_CONTEXT.md)** — Comprehensive architecture, phase roadmap, 3-tier cascade details, taxonomy rules, and course-correction audit checklist.
- **[HOW_TO_PREVIEW_EXTENSION.md](file:///c:/Users/CSE%20LAB%201/Downloads/HaCha/HOW_TO_PREVIEW_EXTENSION.md)** — Step-by-step Chrome Extension previewing, reloading, and debugging guide.
- **[phase details/](file:///c:/Users/CSE%20LAB%201/Downloads/HaCha/phase%20details)** — Phase-by-phase detailed specifications (Phases 0 through 14).

---

## 🛡️ License

MIT License.
