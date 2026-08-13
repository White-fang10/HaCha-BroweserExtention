# HaCha AI Fact Checker
## Phase 0 — Project Setup & Scaffolding

> **Phase objective:** Establish a clean, reproducible development foundation for HaCha AI before implementing any browser-extension or AI functionality.

---

## 1. Phase Overview

Phase 0 is the **foundation phase** of the HaCha AI project.

The purpose of this phase is not to build any user-facing fact-checking functionality. Instead, it creates the project structure, development environments, service boundaries, configuration files, local infrastructure, and documentation required by every later phase.

HaCha AI consists of three primary runtime components:

```text
┌─────────────────────────────────────────────┐
│              HaCha AI System                │
├─────────────────────────────────────────────┤
│                                             │
│  Chrome Extension                           │
│       │                                     │
│       │ HTTP/HTTPS                          │
│       ▼                                     │
│  Node.js + Express Gateway                  │
│       │                                     │
│       ├──────────────► Redis Cache           │
│       │                                     │
│       │ HTTP                                │
│       ▼                                     │
│  Python + FastAPI AI Service                │
│                                             │
│  MongoDB ── persistent application data     │
│                                             │
└─────────────────────────────────────────────┘
```

The monorepo will keep these components separated while allowing them to be developed and tested together.

---

# 2. Goals of Phase 0

By the end of this phase, the project should have:

- A Git repository
- A monorepo structure
- Separate directories for the extension, backend, AI service, and documentation
- TypeScript configuration for Node-based services
- A Python virtual environment for the AI service
- A basic FastAPI application
- A basic Express application
- A minimal Chrome extension project scaffold
- Local Redis running through Docker
- Local MongoDB running through Docker or a configured MongoDB Atlas development database
- Environment-variable templates
- A root README
- Service-specific READMEs where useful
- Health-check endpoints for backend services
- A reproducible local development workflow
- No committed API keys, passwords, tokens, or other secrets

---

# 3. Why Phase 0 Is Important

HaCha AI will eventually contain several technologies:

```text
Chrome Extension
       +
TypeScript
       +
Node.js
       +
Express
       +
Redis
       +
MongoDB
       +
Python
       +
FastAPI
       +
RAG
       +
LLM
```

If these components are introduced without a defined structure, the project can quickly become difficult to maintain.

Phase 0 therefore establishes:

### Separation of responsibilities

Each service gets a clearly defined purpose.

### Reproducibility

Another developer should be able to clone the repository and understand how to start the project.

### Configuration safety

Secrets should never be hard-coded into source files.

### Dependency isolation

Node.js dependencies remain inside Node projects, while Python dependencies remain inside the AI service.

### Early failure detection

Health endpoints allow us to verify that the infrastructure is working before building complicated functionality.

---

# 4. Proposed Repository Structure

The initial repository should look approximately like this:

```text
hacha-ai/
│
├── extension/
│   ├── src/
│   ├── public/
│   ├── manifest.json
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── config/
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md
│
├── ai-service/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── services/
│   │   ├── core/
│   │   └── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── decisions/
│   └── development/
│
├── docker/
│   └── docker-compose.yml
│
├── .gitignore
├── .env.example
├── README.md
└── LICENSE
```

This structure can evolve later. Phase 0 should avoid creating unnecessary application code before its requirements are known.

---

# 5. Service Responsibilities

## 5.1 Chrome Extension

The extension will eventually handle:

- User activation
- Region selection
- Screenshot/region processing
- Local OCR
- Verification requests
- Result overlay
- Browser-side state

It should **not** contain server-side secrets.

For example, an API key for a private backend should never be embedded directly into extension JavaScript.

---

## 5.2 Backend Gateway

The Node.js backend will eventually handle:

- Requests from the extension
- Request validation
- Claim normalization
- Claim hashing
- Redis cache access
- Fact-check API orchestration
- Communication with the AI service
- Persistent records
- Rate limiting
- Backend logging

It acts as the central gateway rather than allowing the browser extension to communicate directly with every external service.

---

## 5.3 AI Service

The Python service will eventually handle:

- Claim analysis
- Evidence retrieval
- Query generation
- RAG
- Embeddings
- Evidence ranking
- LLM inference
- Structured verification results

Keeping this separate allows AI-specific dependencies to evolve independently from the Node.js gateway.

---

## 5.4 Redis

Redis will eventually provide:

- Exact claim cache
- Potential semantic-cache metadata
- Temporary verification state
- Rate-limit counters
- Performance metrics

During Phase 0, Redis only needs to be available and reachable.

---

## 5.5 MongoDB

MongoDB will eventually store persistent information such as:

- Verification records
- Claim metadata
- Analytics
- System events
- Evaluation data

Phase 0 only requires a working development database connection.

---

# 6. Development Environment

Recommended baseline:

### Operating system

Windows, Linux, or macOS.

### Required software

```text
Git
Node.js
npm
Python
Docker Desktop
Google Chrome
VS Code or another IDE
```

Recommended Node.js version:

```text
Node.js 20 LTS or newer LTS
```

Recommended Python version:

```text
Python 3.11+
```

The exact versions should be pinned/documented once the dependency set is finalized.

---

# 7. Git Repository Initialization

Create the project directory:

```bash
mkdir hacha-ai
cd hacha-ai
```

Initialize Git:

```bash
git init
```

Create the initial branch if desired:

```bash
git branch -M main
```

The first commit should represent the clean project scaffold rather than incomplete application functionality.

Suggested initial commit:

```text
chore: initialize HaCha AI monorepo
```

---

# 8. Git Ignore Strategy

The repository must never contain:

```text
node_modules/
__pycache__/
.venv/
.env
.env.local
*.log
dist/
build/
coverage/
.vscode/
.idea/
```

It should also exclude:

```text
*.pem
*.key
secrets/
credentials/
```

unless a specific file is intentionally required and contains no secret information.

A `.env.example` file should be committed, but the real `.env` file should not be.

---

# 9. Environment Configuration

HaCha has multiple services, so configuration should be separated.

Example backend environment:

```env
NODE_ENV=development
PORT=3000

REDIS_URL=redis://localhost:6379

MONGODB_URI=mongodb://localhost:27017/hacha

AI_SERVICE_URL=http://localhost:8000
```

Example AI-service environment:

```env
ENVIRONMENT=development
PORT=8000

MODEL_PROVIDER=local
MODEL_NAME=development-model

LOG_LEVEL=INFO
```

Example root `.env.example` should contain only non-secret placeholders or references to service-specific configuration.

If an API key is eventually required:

```env
FACT_CHECK_API_KEY=your_api_key_here
```

Never commit the real value.

---

# 10. Node.js Project Setup

The backend should be initialized as a TypeScript project.

Example:

```bash
cd backend
npm init -y
```

Install the initial development dependencies:

```bash
npm install express cors dotenv
npm install zod
npm install -D typescript tsx @types/node @types/express
```

Additional dependencies should be introduced only when their functionality is actually implemented.

The purpose of Phase 0 is to keep the initial dependency footprint small.

---

# 11. Backend TypeScript Configuration

Create:

```text
backend/tsconfig.json
```

The configuration should provide:

- Strict type checking
- Modern JavaScript target
- Node-compatible module resolution
- Source directory
- Build directory

A reasonable conceptual configuration is:

```text
src/
 ↓
TypeScript compiler
 ↓
dist/
```

The exact module system should be selected once the backend implementation begins.

---

# 12. Initial Backend Application

The backend should expose:

```text
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "service": "hacha-backend",
  "environment": "development"
}
```

At this stage, there should be no fact-checking logic.

The endpoint exists only to prove that the gateway is running.

---

# 13. Python AI Service Setup

Create the service:

```bash
cd ai-service
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

On Linux/macOS:

```bash
source .venv/bin/activate
```

Upgrade pip:

```bash
python -m pip install --upgrade pip
```

Install the initial framework:

```bash
pip install fastapi uvicorn pydantic
```

Freeze the initial environment:

```bash
pip freeze > requirements.txt
```

Do not install the complete RAG/LLM stack yet.

Those dependencies belong to later phases when the exact retrieval and inference strategy has been selected.

---

# 14. Initial AI Service

The AI service should expose:

```text
GET /health
```

Example:

```json
{
  "status": "ok",
  "service": "hacha-ai-service",
  "environment": "development"
}
```

The `/verify` endpoint can be introduced as a stub in a later phase when the Node-to-Python contract is formally defined.

---

# 15. Chrome Extension Scaffold

The extension directory should contain the minimum structure required for a Manifest V3 extension.

Conceptually:

```text
extension/
│
├── src/
│   ├── popup/
│   ├── content/
│   └── background/
│
├── public/
│
├── manifest.json
├── package.json
└── tsconfig.json
```

The extension should initially do nothing more than load successfully.

The actual activation workflow belongs to Phase 1.

---

# 16. Manifest Philosophy

The project should follow a **least-privilege permission model**.

The initial plan proposes:

```text
activeTab
scripting
storage
```

Avoid requesting broad permissions such as:

```text
<all_urls>
tabs
history
webNavigation
```

unless a later feature genuinely requires them.

This is important because HaCha's privacy model depends partly on minimizing browser permissions.

---

# 17. Docker Infrastructure

Redis and MongoDB should be available locally without requiring every developer to install them manually.

Use Docker Compose for development infrastructure.

Conceptually:

```text
Docker Compose
│
├── Redis
│   └── localhost:6379
│
└── MongoDB
    └── localhost:27017
```

The infrastructure should be isolated from the application containers during early development.

This means:

```text
Chrome Extension ───────┐
                        │
Node Backend ───────────┤
                        │
Python AI Service ──────┤
                        │
                        ▼
                 Docker Infrastructure
                 ├── Redis
                 └── MongoDB
```

---

# 18. Redis Development Setup

The Redis container should expose:

```text
6379
```

The backend should eventually connect using:

```text
redis://localhost:6379
```

Phase 0 only requires confirming that Redis responds.

Example verification:

```bash
docker ps
```

Then inspect the Redis container logs if necessary.

The actual claim-cache implementation belongs to Phase 6.

---

# 19. MongoDB Development Setup

MongoDB should expose:

```text
27017
```

The development database can use a database name such as:

```text
hacha
```

The database should not contain production data.

If MongoDB Atlas is used instead of Docker, the connection string must remain inside `.env` and never be committed.

---

# 20. Root README

The root README should explain:

```text
1. What HaCha AI is
2. Repository structure
3. Prerequisites
4. How to start Redis
5. How to start MongoDB
6. How to start the backend
7. How to start the AI service
8. How to load the extension
9. Environment configuration
10. Development roadmap
```

At this stage, the README should clearly state that the project is under active development.

---

# 21. Documentation Structure

The `/docs` directory should become the project's technical knowledge base.

Suggested structure:

```text
docs/
│
├── architecture/
│   ├── system-overview.md
│   └── service-boundaries.md
│
├── api/
│   └── README.md
│
├── decisions/
│   └── architecture-decisions.md
│
└── development/
    └── local-setup.md
```

The documentation should evolve alongside the implementation.

---

# 22. Architecture Decision Record

Create a lightweight record of important decisions.

Examples:

```text
ADR-001:
Use a monorepo.

ADR-002:
Use Chrome Manifest V3.

ADR-003:
Perform OCR locally.

ADR-004:
Use Node.js as the API gateway.

ADR-005:
Separate AI inference into Python/FastAPI.

ADR-006:
Use Redis for verification caching.
```

This becomes particularly useful when the architecture changes later.

---

# 23. Initial Service Dependency Graph

At the end of Phase 0, the expected dependency graph is:

```text
                    ┌────────────────┐
                    │ Chrome         │
                    │ Extension      │
                    └───────┬────────┘
                            │
                            │ future
                            ▼
                    ┌────────────────┐
                    │ Node Backend   │
                    │ Express        │
                    └───┬────────┬───┘
                        │        │
                        │        │ future
                        ▼        ▼
                  ┌─────────┐ ┌──────────────┐
                  │ Redis   │ │ Python AI    │
                  │         │ │ FastAPI      │
                  └─────────┘ └──────────────┘
                        │
                        │
                        ▼
                  ┌───────────┐
                  │ MongoDB   │
                  └───────────┘
```

The arrows marked as future indicate that the services do not need to contain their final integrations during Phase 0.

---

# 24. Health-Check Strategy

Every server component should eventually expose a health endpoint.

### Node

```text
GET /api/health
```

### Python

```text
GET /health
```

Later, separate readiness checks can be introduced:

```text
/health/live
/health/ready
```

A readiness check could eventually verify:

```text
Backend
 ├── Redis reachable
 ├── MongoDB reachable
 └── AI service reachable
```

However, this level of health checking is not required for Phase 0.

---

# 25. Local Development Workflow

The intended local workflow should eventually look like:

### Terminal 1 — Infrastructure

```bash
docker compose up -d
```

### Terminal 2 — Backend

```bash
cd backend
npm run dev
```

### Terminal 3 — AI Service

```bash
cd ai-service
uvicorn app.main:app --reload --port 8000
```

### Browser

Load the extension through:

```text
Chrome
→ Extensions
→ Developer mode
→ Load unpacked
→ extension/
```

At the end of Phase 0, the extension does not need to perform fact checking yet.

---

# 26. Testing the Phase 0 Environment

The following checks should succeed.

## Git

```bash
git status
```

The repository should be clean after committing the scaffold.

## Backend

Open:

```text
http://localhost:3000/api/health
```

Expected:

```json
{
  "status": "ok"
}
```

## AI Service

Open:

```text
http://localhost:8000/health
```

Expected:

```json
{
  "status": "ok"
}
```

## Redis

Confirm that the Redis container is running:

```bash
docker ps
```

## MongoDB

Confirm that the MongoDB container is running:

```bash
docker ps
```

## Extension

Chrome should successfully load the unpacked extension without manifest errors.

---

# 27. Phase 0 Exit Criteria

Phase 0 is complete only when all of the following are true:

- [ ] Git repository initialized
- [ ] Root project structure created
- [ ] `/extension` created
- [ ] `/backend` created
- [ ] `/ai-service` created
- [ ] `/docs` created
- [ ] `.gitignore` configured
- [ ] Root README created
- [ ] Environment templates created
- [ ] No secrets committed
- [ ] Node.js/TypeScript environment works
- [ ] Python virtual environment works
- [ ] FastAPI starts successfully
- [ ] Express starts successfully
- [ ] Backend health endpoint responds
- [ ] AI-service health endpoint responds
- [ ] Redis starts successfully
- [ ] MongoDB starts successfully or Atlas development connection is configured
- [ ] Chrome recognizes the extension scaffold
- [ ] Local setup instructions are documented

---

# 28. What Phase 0 Does NOT Implement

Do not implement the following during Phase 0:

```text
❌ OCR
❌ Screenshot capture
❌ Region selection
❌ Fact-checking
❌ RAG
❌ LLM inference
❌ Claim normalization
❌ Redis claim caching
❌ MongoDB application models
❌ Search integration
❌ Authentication
❌ Rate limiting
❌ Production deployment
❌ Chrome Web Store publishing
```

Those features belong to later phases.

This restriction is intentional.

The objective is to create a **stable foundation before adding complexity**.

---

# 29. Recommended First Commit Structure

A good initial commit sequence could be:

```text
commit 1:
chore: initialize HaCha AI monorepo

commit 2:
chore: scaffold Node backend

commit 3:
chore: scaffold Python AI service

commit 4:
chore: add Chrome extension scaffold

commit 5:
chore: add local Redis and MongoDB infrastructure

commit 6:
docs: add local development documentation
```

Keeping commits logically separated makes debugging and rollback easier.

---

# 30. Definition of Done

Phase 0 is considered successful when a new developer can clone the repository and, by following the documentation, reach this state:

```text
                 HaCha AI
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    Extension    Backend     AI Service
      READY       READY         READY
                    │
              ┌─────┴─────┐
              ▼           ▼
            Redis       MongoDB
             READY       READY
```

No actual fact-checking functionality is expected yet.

The important result is that **the entire development environment is operational and ready for Phase 1**.

---

# 31. Phase 0 Deliverables

At the end of the phase, the repository should contain:

```text
HaCha AI/
│
├── extension/
│   └── Working MV3 scaffold
│
├── backend/
│   └── Working Express + TypeScript scaffold
│
├── ai-service/
│   └── Working FastAPI scaffold
│
├── docs/
│   └── Architecture and setup documentation
│
├── docker/
│   └── Local Redis + MongoDB configuration
│
├── .gitignore
├── .env.example
└── README.md
```

The project should be **cloneable, configurable, runnable, and testable** before moving to Phase 1.

---

# 32. Recommended Development Principle

For the entire HaCha project, follow this rule:

> **Every phase must produce something runnable before the next phase begins.**

The development progression should therefore be:

```text
Phase 0
Foundation
   ↓
Phase 1
Working Extension
   ↓
Phase 2
Selection Tool
   ↓
Phase 3
Local OCR
   ↓
Phase 4
Backend Gateway
   ↓
Phase 5
Claim Processing
   ↓
Phase 6
Caching
   ↓
Phase 7
Fact Checking
   ↓
Phase 8
AI Service
   ↓
Phase 9
Evidence Retrieval
   ↓
Phase 10
RAG + LLM
   ↓
Phase 11
Complete UX
   ↓
Phase 12
Security
   ↓
Phase 13
Evaluation
   ↓
Phase 14
Deployment
```

This dependency order minimizes the risk of building a large amount of AI infrastructure before the fundamental browser interaction is proven.

---

# Phase 0 Summary

**Phase 0 is the infrastructure and project-foundation phase of HaCha AI.**

Its purpose is to establish the monorepo, development environments, service boundaries, local databases, Redis infrastructure, environment configuration, documentation, and health-check mechanisms.

The phase should end with **three independently runnable components — Chrome Extension, Node.js Gateway, and Python AI Service — plus Redis and MongoDB running locally**.

Once this foundation is stable, Phase 1 can begin implementing the actual HaCha browser-extension experience.
