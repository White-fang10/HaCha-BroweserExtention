# HaCha AI Verification Service - Phase 8

## Overview

Python FastAPI microservice for evidence-grounded claim verification. Phase 8 establishes
the service contract and infrastructure; the actual RAG + LLM pipeline arrives in Phases 9–10.

## Architecture

```text
Chrome Extension
       ↓
Node.js Gateway
       ↓ HTTP (Bearer token)
Python AI Service (FastAPI)
       ↓
Stub Response (Phase 8)
```

## Endpoints

- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe
- `POST /verify` - Verification request (requires internal token)

## Quick Start

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Linux/macOS)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run service
python -m app.main
```

Service starts at `http://localhost:8000`.

## Configuration

Copy `.env.example` to `.env` and adjust values. Never commit `.env`.

## Testing

```bash
pytest -v
```

## What Phase 8 Does NOT Implement

- ❌ Web search
- ❌ News retrieval
- ❌ Vector database
- ❌ Embedding model
- ❌ RAG
- ❌ LLM inference

Those belong to Phases 9 and 10.
