# HaCha AI Fact Checker
## Phase 1 — Browser Extension Skeleton (Manifest V3)

> **Phase objective:** Build the first working version of the HaCha Chrome extension so that the browser can load it, the popup can activate it, and the extension can inject a content script into the active webpage. No OCR, screenshot capture, fact checking, backend communication, or AI functionality is implemented in this phase.

---

# 1. Phase Overview

Phase 1 converts the empty extension scaffold created in Phase 0 into a **working Chrome Manifest V3 extension**.

At the end of this phase, the user should be able to:

```text
Chrome
  ↓
Open HaCha extension
  ↓
Click "Activate HaCha"
  ↓
Extension communicates with the active tab
  ↓
Content script is injected
  ↓
Confirmation appears on the webpage
```

The extension is intentionally simple at this stage.

The goal is to prove the browser-side foundation before implementing the region-selection system in Phase 2.

---

# 2. Phase 1 Goals

By the end of Phase 1, the project should have:

- A valid Chrome Manifest V3 configuration
- A working extension icon
- A popup interface
- A background service worker
- A content script
- Popup → service worker communication
- Service worker → content script communication
- A basic activation state
- Minimal browser permissions
- TypeScript-based extension source code
- A development build process
- A reloadable unpacked extension
- Basic browser-side error handling
- A clear foundation for Phase 2 region selection

---

# 3. What Phase 1 Does NOT Implement

Do not implement the following yet:

```text
❌ Region selection
❌ Screenshot capture
❌ Canvas cropping
❌ OCR
❌ Tesseract.js
❌ Claim extraction
❌ Backend API calls
❌ Redis
❌ Fact-checking
❌ RAG
❌ LLM
❌ Verification UI
```

Phase 1 only proves:

> **The HaCha extension can reliably activate functionality inside the current browser tab.**

---

# 4. Architecture

The Phase 1 architecture is:

```text
                    Chrome Browser
                          │
                          │
                  ┌───────▼────────┐
                  │ HaCha Extension │
                  └───────┬────────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
          Popup      Service Worker   Storage
             │            │
             │            │
             └────────────┤
                          │
                          ▼
                   Active Webpage
                          │
                          ▼
                   Content Script
```

The important communication path is:

```text
Popup
  ↓
Service Worker
  ↓
Content Script
  ↓
Current Webpage
```

---

# 5. Why Manifest V3?

HaCha should be implemented using Chrome's current extension architecture.

Manifest V3 provides:

- Service workers instead of persistent background pages
- Better permission controls
- Modern extension APIs
- Improved security
- Explicit extension capabilities
- A structure suitable for Chrome Web Store publication

The extension should be designed around MV3 from the beginning rather than migrating from an older Manifest V2 architecture later.

---

# 6. Proposed Directory Structure

After Phase 1, the extension directory should look approximately like:

```text
extension/
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   └── content-script.ts
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   │
│   ├── shared/
│   │   ├── messages.ts
│   │   └── types.ts
│   │
│   └── assets/
│       └── icons/
│
├── public/
│
├── dist/
│
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

The exact bundler structure can vary, but the logical separation should remain.

---

# 7. Component Responsibilities

## 7.1 Popup

The popup is the user's entry point.

Its initial responsibility is simple:

```text
Display:
HaCha AI

[ Activate HaCha ]
```

When the user clicks the button, the popup sends an activation message.

The popup should not contain the selection logic.

---

# 8. Service Worker

The service worker is the extension's background coordinator.

It will eventually handle:

- Extension lifecycle
- Communication between popup and content scripts
- Extension state
- Backend communication
- Browser APIs
- Request coordination

In Phase 1 it only needs to:

1. Receive the activation request.
2. Determine the active tab.
3. Inject or communicate with the content script.
4. Send an activation message.
5. Return success/failure to the popup.

---

# 9. Content Script

The content script runs inside the active webpage.

In Phase 1 it should only prove that injection works.

For example, when activated it can display a temporary message:

```text
HaCha AI activated
```

or log:

```text
[HaCha] Content script activated
```

The content script will later become responsible for:

```text
Selection overlay
Canvas
Bounding box
Coordinates
OCR
Result positioning
```

But those features belong to later phases.

---

# 10. Shared Messaging

A major goal of Phase 1 is to establish a clean messaging system.

Avoid scattering raw strings throughout the code.

Instead of:

```text
"start"
"activate"
"run"
"begin"
```

define explicit message types.

Conceptually:

```typescript
type HaChaMessage =
  | {
      type: "ACTIVATE_HACHA";
    }
  | {
      type: "DEACTIVATE_HACHA";
    }
  | {
      type: "PING_CONTENT";
    };
```

This becomes increasingly important as the extension grows.

---

# 11. Message Flow

The activation flow should be:

```text
User
 │
 │ clicks Activate
 ▼
Popup
 │
 │ ACTIVATE_HACHA
 ▼
Service Worker
 │
 │ find active tab
 ▼
Chrome Tabs API
 │
 │ target tab
 ▼
Content Script
 │
 │ ACTIVATE
 ▼
Webpage
 │
 ▼
Temporary activation indicator
```

The popup should receive a response:

```json
{
  "success": true
}
```

or:

```json
{
  "success": false,
  "error": "Unable to activate HaCha on this page."
}
```

---

# 12. Manifest Configuration

The extension should use Manifest V3.

The initial manifest should contain only the permissions required by the current phase.

Conceptually:

```json
{
  "manifest_version": 3,
  "name": "HaCha AI Fact Checker",
  "version": "0.1.0",
  "description": "User-controlled evidence-based claim verification.",
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "service-worker.js"
  },
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ]
}
```

The exact generated paths depend on the build system.

---

# 13. Permission Philosophy

HaCha's privacy model depends heavily on minimizing permissions.

The extension should request permissions only when they are necessary.

Initial permissions:

### `activeTab`

Allows temporary access to the current active tab after the user interacts with the extension.

This is particularly suitable for HaCha because the user explicitly initiates verification.

### `scripting`

Allows the extension to inject the required content script.

### `storage`

Allows extension configuration/state to be stored locally.

---

# 14. Permissions We Should Avoid Initially

Do not request broad permissions simply because they might become useful later.

Avoid unnecessary use of:

```text
<all_urls>
tabs
history
webNavigation
cookies
bookmarks
```

unless a future feature has a concrete requirement.

This improves:

- Security
- Privacy
- User trust
- Chrome Web Store reviewability

---

# 15. Popup UI

The first popup should be deliberately minimal.

Example:

```text
┌──────────────────────────────┐
│                              │
│          HaCha AI            │
│      Fact Checker            │
│                              │
│  Select a claim on this      │
│  webpage and verify it.      │
│                              │
│    ┌────────────────────┐    │
│    │   Activate HaCha   │    │
│    └────────────────────┘    │
│                              │
│             v0.1.0           │
└──────────────────────────────┘
```

Do not build the final polished UI yet.

The objective is functional correctness.

---

# 16. Popup States

The popup should have a small state machine.

```text
IDLE
 │
 │ click Activate
 ▼
ACTIVATING
 │
 ├───────────────┐
 │               │
 ▼               ▼
ACTIVE          ERROR
```

### IDLE

```text
Activate HaCha
```

### ACTIVATING

```text
Activating...
```

The button should be disabled during the request.

### ACTIVE

```text
HaCha Active
```

### ERROR

```text
Activation failed
Try again
```

---

# 17. Content-Script Activation State

The content script should maintain a simple state:

```text
INACTIVE
ACTIVE
```

When it receives:

```text
ACTIVATE_HACHA
```

it changes to:

```text
ACTIVE
```

and displays a temporary indicator.

Example:

```text
┌──────────────────────────┐
│ HaCha AI Activated       │
│ Region selection coming  │
│ in the next phase.       │
└──────────────────────────┘
```

This indicator should disappear automatically after a few seconds.

---

# 18. Avoid Permanent DOM Pollution

The content script should not continuously add elements to the webpage.

When activated:

```text
Create indicator
      ↓
Display
      ↓
Timeout
      ↓
Remove
```

This establishes a clean pattern for future overlays.

The same principle will be important when the selection overlay is implemented in Phase 2.

---

# 19. Handling Restricted Pages

Chrome extensions cannot inject normal content scripts into every browser page.

Examples may include:

```text
chrome:// pages
Chrome Web Store pages
Certain browser-internal pages
```

The extension must handle these situations gracefully.

Instead of crashing, the popup should report:

```text
HaCha cannot run on this page.
```

This should be treated as a normal capability limitation.

---

# 20. Active Tab Detection

When the user clicks the extension action, the service worker should identify the active tab.

Conceptually:

```text
Current window
      ↓
Active tab
      ↓
Tab ID
      ↓
Inject/activate content script
```

The extension should not attempt to scan all open tabs.

---

# 21. Content Script Injection Strategy

For Phase 1, use **on-demand injection**.

That means:

```text
Extension clicked
       ↓
Service Worker
       ↓
Inject content script
```

rather than permanently injecting the content script into every webpage.

This fits HaCha's privacy-oriented design.

It also reduces:

- Memory usage
- Startup overhead
- Unnecessary webpage modification

---

# 22. Activation Idempotency

The activation command should be safe to execute more than once.

If the user clicks:

```text
Activate
Activate
Activate
```

the webpage should not end up with:

```text
3 overlays
3 listeners
3 timers
3 state objects
```

Instead:

```text
Already active
      ↓
Reuse existing state
```

This is especially important because Phase 2 will add event listeners and selection UI.

---

# 23. Message Contract

Define a shared message contract early.

Example:

```typescript
export type MessageType =
  | "ACTIVATE_HACHA"
  | "DEACTIVATE_HACHA"
  | "GET_STATUS";
```

Example request:

```typescript
{
  type: "ACTIVATE_HACHA"
}
```

Example response:

```typescript
{
  success: true,
  type: "ACTIVATION_RESULT"
}
```

This creates a stable communication boundary for later phases.

---

# 24. Error Handling

The extension should handle at least:

### No active tab

```text
Unable to identify active tab.
```

### Restricted page

```text
HaCha cannot run on this page.
```

### Injection failure

```text
Could not activate HaCha.
```

### Content script unavailable

```text
HaCha content module is unavailable.
Please try again.
```

Errors should be logged for development but presented to the user in simple language.

---

# 25. Development Logging

During development, use a consistent prefix:

```text
[HaCha][Popup]
[HaCha][Background]
[HaCha][Content]
```

Example:

```text
[HaCha][Popup] Activation requested
[HaCha][Background] Active tab: 123
[HaCha][Background] Injecting content script
[HaCha][Content] Activation received
```

This makes debugging the multi-context extension considerably easier.

Production builds can later reduce or disable verbose logging.

---

# 26. Extension Build Process

The extension source should be written in TypeScript, but Chrome needs compiled JavaScript.

Therefore:

```text
TypeScript source
       ↓
Build system
       ↓
JavaScript
       ↓
dist/
       ↓
Chrome loads dist/
```

The build system should eventually handle:

- TypeScript compilation
- HTML copying
- CSS copying
- Manifest copying
- Asset copying
- Output cleanup

Keep the build process simple during Phase 1.

---

# 27. Recommended Package Scripts

The extension package should eventually expose commands similar to:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "typecheck": "...",
    "lint": "..."
  }
}
```

The exact commands depend on the chosen bundler.

The important point is that the developer should not manually compile individual TypeScript files.

---

# 28. Recommended Development Loop

The intended workflow is:

```text
Edit TypeScript
      ↓
Build extension
      ↓
Chrome Extensions
      ↓
Reload extension
      ↓
Open webpage
      ↓
Click HaCha
      ↓
Inspect console
```

If a watcher is configured later, this can become faster.

---

# 29. Chrome Loading Procedure

For development:

```text
Chrome
  ↓
chrome://extensions
  ↓
Enable Developer Mode
  ↓
Load unpacked
  ↓
Select extension/dist
```

After rebuilding:

```text
Reload extension
```

If the content script was already injected into a webpage, refresh the webpage when necessary.

---

# 30. Testing Strategy

Phase 1 should include basic manual and automated tests.

## Manual test

1. Load extension.
2. Open a normal webpage.
3. Click HaCha.
4. Verify activation message.
5. Open DevTools.
6. Verify content-script logs.
7. Click activation again.
8. Verify duplicate UI is not created.
9. Try a restricted browser page.
10. Verify graceful failure.

---

# 31. Basic Unit Tests

The following logic can be unit tested:

### Message validation

```text
ACTIVATE_HACHA → valid
UNKNOWN_MESSAGE → invalid
```

### State transitions

```text
INACTIVE → ACTIVE
ACTIVE → ACTIVE
```

### Error handling

```text
Injection failure → controlled error
```

The goal is not to build a huge test suite yet.

The goal is to protect the extension's communication foundation.

---

# 32. Security Considerations

Even in Phase 1, follow secure extension practices.

### Do not use

```text
eval()
new Function()
```

### Do not inject arbitrary HTML

Avoid directly inserting untrusted strings through:

```text
innerHTML
```

when DOM APIs can be used instead.

### Do not expose secrets

Never place:

```text
API keys
database passwords
JWT signing secrets
private tokens
```

inside the extension.

### Use least privilege

Request only the permissions that are currently necessary.

---

# 33. Privacy Considerations

HaCha should establish its privacy principles from the first extension version.

Phase 1 should not:

- Read webpage content automatically
- Monitor all tabs
- Track browsing history
- Collect URLs unnecessarily
- Send webpage content anywhere
- Run continuously in the background

The extension should only activate when the user explicitly interacts with it.

This principle will become critical during Phase 3 when OCR is introduced.

---

# 34. Future Compatibility With Phase 2

The extension architecture should be designed so that Phase 2 can add:

```text
ACTIVATE_HACHA
       ↓
Selection Mode
       ↓
Overlay
       ↓
Mouse Events
       ↓
Bounding Box
```

without rewriting the entire extension.

Therefore, keep selection logic separate from:

- Popup
- Service worker
- Messaging
- Shared types

---

# 35. Future Compatibility With Phase 3

Phase 3 will add:

```text
Selection Box
      ↓
Canvas
      ↓
Tesseract.js
      ↓
OCR Text
```

The content script should therefore be treated as the eventual home for the interactive browser-side workflow.

A conceptual future structure is:

```text
content/
│
├── content-script.ts
├── selection/
│   ├── selection-manager.ts
│   ├── selection-overlay.ts
│   └── selection-state.ts
│
├── ocr/
│   ├── ocr-engine.ts
│   └── image-preprocessor.ts
│
└── ui/
    └── verification-overlay.ts
```

Do not create all these files yet unless they are needed.

---

# 36. Phase 1 Milestone

The key milestone is:

> **"Clicking the HaCha extension activates a browser-side HaCha session on the current webpage."**

A successful demonstration should look like:

```text
             Chrome Webpage
┌────────────────────────────────────────┐
│                                        │
│  Some article or social-media content  │
│                                        │
│                         ┌────────────┐ │
│                         │ HaCha AI   │ │
│                         │ Activated  │ │
│                         └────────────┘ │
│                                        │
└────────────────────────────────────────┘
                    ▲
                    │
              User clicks
                    │
             HaCha extension
```

---

# 37. Phase 1 Exit Criteria

Phase 1 is complete only when all of the following are true:

- [ ] Manifest V3 extension loads successfully.
- [ ] Extension icon is visible in Chrome.
- [ ] Popup opens correctly.
- [ ] Popup contains an Activate button.
- [ ] Popup can communicate with the service worker.
- [ ] Service worker can identify the active tab.
- [ ] Content script can be injected on supported webpages.
- [ ] Content script receives the activation message.
- [ ] Activation state is maintained correctly.
- [ ] Repeated activation does not create duplicate UI/listeners.
- [ ] Restricted pages fail gracefully.
- [ ] Console logging is clear and consistent.
- [ ] TypeScript compiles without errors.
- [ ] Extension build produces a loadable `dist` directory.
- [ ] No unnecessary browser permissions are requested.
- [ ] No secrets are stored in the extension.
- [ ] Basic tests/manual verification pass.
- [ ] README contains extension development and loading instructions.

---

# 38. Definition of Done

The phase is considered complete when a developer can perform:

```text
npm install
      ↓
npm run build
      ↓
chrome://extensions
      ↓
Load unpacked
      ↓
Open webpage
      ↓
Click HaCha
      ↓
"HaCha AI Activated"
```

without manually modifying generated JavaScript or configuration files.

---

# 39. Phase 1 Deliverables

At the end of Phase 1:

```text
extension/
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   └── content-script.ts
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   │
│   └── shared/
│       ├── messages.ts
│       └── types.ts
│
├── manifest.json
├── package.json
├── tsconfig.json
├── README.md
└── dist/
```

The exact structure may differ depending on the build tooling.

---

# 40. Suggested Git Commits

Keep Phase 1 commits logically separated.

```text
feat(extension): add Manifest V3 configuration

feat(extension): add popup interface

feat(extension): add background service worker

feat(extension): add content script activation

feat(extension): add popup-background messaging

feat(extension): add shared message types

test(extension): add activation state tests

docs(extension): document local extension development
```

This makes it easier to identify which part introduced a future regression.

---

# 41. Phase 1 Final Architecture

At the end of Phase 1:

```text
                         USER
                           │
                           │ Click
                           ▼
                  ┌─────────────────┐
                  │ Extension Popup │
                  └────────┬────────┘
                           │
                    Message Request
                           │
                           ▼
                  ┌─────────────────┐
                  │ Service Worker  │
                  └────────┬────────┘
                           │
                     Active Tab
                           │
                           ▼
                  ┌─────────────────┐
                  │ Content Script  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Webpage         │
                  │                 │
                  │ HaCha Activated │
                  └─────────────────┘
```

---

# 42. Phase 1 Summary

Phase 1 establishes the **browser-side control layer** of HaCha AI.

The extension does not yet understand claims, capture screenshots, perform OCR, or communicate with the AI backend.

Instead, it proves the fundamental interaction:

> **User explicitly activates HaCha → extension obtains access to the active webpage → content script starts a HaCha session.**

This foundation is intentionally small.

The next phase can then build the actual interaction that makes HaCha unique:

```text
Phase 1
Activation
    ↓
Phase 2
Region Selection
    ↓
Phase 3
Local OCR
```

The most important outcome is therefore not visual complexity but **a clean, permission-conscious, message-driven extension architecture that can grow without being rewritten.**
