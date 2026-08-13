# HaCha AI Fact Checker
## Phase 11 — Contextual Overlay UI

> **Objective:** Connect the completed verification pipeline to the Chrome extension and present the result as a clean, contextual overlay positioned near the user's selected claim.

---

## 1. Phase Overview

Phases 0–10 established:

```text
Project Setup
    ↓
MV3 Extension
    ↓
Region Selection
    ↓
Local OCR
    ↓
Node Gateway
    ↓
Normalization + Hashing
    ↓
Redis Cache
    ↓
Fact-Check API
    ↓
Python AI Service
    ↓
Evidence Retrieval
    ↓
RAG + LLM Reasoning
```

Phase 11 turns this backend capability into the final user-facing interaction:

```text
Activate HaCha
    ↓
Select region
    ↓
OCR locally
    ↓
Confirm/edit claim
    ↓
Verify
    ↓
Show loading state
    ↓
Receive validated result
    ↓
Display contextual result card
```

The user should be able to fact-check a claim **without leaving the webpage**.

---

# 2. Phase Goals

By the end of Phase 11:

- [ ] Selection state connects to the UI.
- [ ] OCR output appears in an editable confirmation dialog.
- [ ] User can correct OCR mistakes.
- [ ] User can cancel or verify.
- [ ] Background service worker handles verification communication.
- [ ] Loading state is displayed.
- [ ] Backend result is rendered safely.
- [ ] `SUPPORTED`, `FALSE`, `MISLEADING`, and `UNVERIFIED` are supported.
- [ ] Confidence is displayed correctly.
- [ ] Explanation is displayed.
- [ ] Evidence/source panel works.
- [ ] Source links are clickable.
- [ ] Result card is positioned near the selected region.
- [ ] Viewport collisions are handled.
- [ ] Scroll and resize behavior is handled.
- [ ] Extension CSS does not interfere with webpage CSS.
- [ ] Webpage CSS does not break the extension UI.
- [ ] Error and timeout states work.
- [ ] Stale responses cannot overwrite newer requests.
- [ ] UI cleanup works after closing.
- [ ] Basic keyboard and accessibility support works.
- [ ] The complete flow works on multiple real websites.

---

# 3. Phase 11 Architecture

```text
                         WEBPAGE
                            │
                            ▼
                    Selection Overlay
                            │
                            ▼
                       Canvas Crop
                            │
                            ▼
                        Local OCR
                            │
                            ▼
                   Claim Confirmation
                            │
                            ▼
                    Content Script
                            │
                            ▼
                 Background Service Worker
                            │
                            ▼
                     Node Gateway
                            │
                            ▼
                 Verification Pipeline
                            │
                            ▼
                   Validated JSON Result
                            │
                            ▼
                 Background Service Worker
                            │
                            ▼
                    Content Script
                            │
                            ▼
                  Contextual Result Card
```

---

# 4. UI State Machine

Use explicit states rather than many independent boolean flags.

```typescript
type HaChaState =
  | "IDLE"
  | "SELECTING"
  | "CAPTURED"
  | "OCR_PROCESSING"
  | "CLAIM_CONFIRMATION"
  | "VERIFYING"
  | "RESULT"
  | "ERROR";
```

Normal flow:

```text
IDLE
 ↓
SELECTING
 ↓
CAPTURED
 ↓
OCR_PROCESSING
 ↓
CLAIM_CONFIRMATION
 ↓
VERIFYING
 ↓
RESULT
```

Failure paths:

```text
OCR_PROCESSING → ERROR
VERIFYING → ERROR
```

Reset:

```text
RESULT → IDLE
ERROR  → IDLE
```

This prevents invalid combinations such as:

```text
isSelecting = true
isLoading = true
isResult = true
```

---

# 5. Recommended Extension Structure

```text
extension/
│
├── manifest.json
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── index.ts
│   │   ├── state.ts
│   │   ├── selection.ts
│   │   ├── overlay.ts
│   │   ├── ocr.ts
│   │   ├── verification.ts
│   │   │
│   │   └── ui/
│   │       ├── root.ts
│   │       ├── claim-dialog.ts
│   │       ├── loading-card.ts
│   │       ├── result-card.ts
│   │       ├── evidence-panel.ts
│   │       └── error-card.ts
│   │
│   └── popup/
│       ├── popup.html
│       ├── popup.ts
│       └── popup.css
│
└── assets/
    └── icons/
```

The exact organization can differ, but selection, communication, state, and presentation should remain separated.

---

# 6. UI Root

Create one extension root instead of scattering elements through the page.

```text
document.body
      │
      ▼
#hacha-root
      │
      └── Shadow Root
            ├── Selection Overlay
            ├── Claim Dialog
            ├── Loading Card
            ├── Result Card
            └── Evidence Panel
```

Before creating it:

```text
Does #hacha-root already exist?
        │
   ┌────┴────┐
  yes       no
   │          │
 reuse      create
```

This prevents duplicate overlays when the user activates HaCha repeatedly.

---

# 7. Shadow DOM / CSS Isolation

Websites can contain global CSS such as:

```css
* { box-sizing: border-box; }
button { all: unset; }
div { font-family: ...; }
```

These rules can break extension UI.

Prefer:

```text
#hacha-root
    ↓
Shadow Root
    ↓
HaCha styles
```

This provides stronger CSS isolation.

The extension must also avoid injecting styles that unintentionally modify the webpage.

---

# 8. Selection Coordinates

Store selection geometry explicitly:

```typescript
interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionContext {
  rect: SelectionRect;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}
```

For overlay positioning, prefer viewport-relative coordinates because:

```javascript
element.getBoundingClientRect()
```

also uses viewport coordinates.

Do not mix:

```text
screen coordinates
document coordinates
viewport coordinates
canvas coordinates
```

without explicit conversion.

---

# 9. Selection UI

During selection:

```text
Mouse down
    ↓
Start rectangle
    ↓
Mouse move
    ↓
Resize rectangle
    ↓
Mouse up
    ↓
Freeze selection
```

Visual design:

```text
┌───────────────────────────────────┐
│███████████████████████████████████│
│██████┌─────────────────┐██████████│
│██████│ selected claim  │██████████│
│██████│                 │██████████│
│██████└─────────────────┘██████████│
│███████████████████████████████████│
└───────────────────────────────────┘
```

Use:

- Darkened background.
- Clear selection border.
- Live rectangle resizing.
- Cursor feedback.
- Clear cancel behavior.

---

# 10. Minimum Selection Size

Reject accidental tiny selections.

Example starting values:

```text
minimum width  = 30px
minimum height = 20px
```

If below the threshold:

```text
Selection too small.
Please select a larger region.
```

Keep these values configurable.

---

# 11. OCR Confirmation UI

After OCR:

```text
┌──────────────────────────────────────┐
│ HaCha — Confirm Claim                │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Extracted claim text...           │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [Cancel]                  [Verify]   │
└──────────────────────────────────────┘
```

The extracted claim must be editable.

---

# 12. Why Editing Is Important

OCR can confuse:

```text
0 ↔ O
1 ↔ I
5 ↔ S
8 ↔ B
```

It can also corrupt:

```text
names
dates
numbers
percentages
URLs
```

A single incorrect number can change the meaning of a claim.

Therefore:

```text
OCR → User confirmation/edit → Verification
```

is preferable to:

```text
OCR → Automatically verify
```

---

# 13. OCR Failure

If OCR returns no useful text:

```text
No readable text was detected.

Try selecting a clearer region.
```

Do not send an empty claim to the backend.

If OCR confidence is available, low OCR confidence may trigger an additional warning.

Do not confuse:

```text
OCR confidence
```

with:

```text
fact-check confidence
```

They represent different things.

---

# 14. Messaging Architecture

Use the background service worker as the extension's communication layer:

```text
Content Script
      │
      │ chrome.runtime.sendMessage
      ▼
Background Service Worker
      │
      │ HTTPS
      ▼
Node Gateway
```

Response:

```text
Node Gateway
      ↓
Background Service Worker
      ↓
Content Script
```

The content script should not contain private backend credentials.

---

# 15. Verification Request

The extension only needs to send the necessary data:

```typescript
interface VerifyRequest {
  claim: string;
  requestId: string;
}
```

The backend handles:

```text
normalization
hashing
Redis
fact-check lookup
retrieval
RAG
LLM
validation
```

The extension should not duplicate those responsibilities.

---

# 16. Verification Response

Conceptually:

```typescript
interface VerifyResponse {
  version?: string;

  status:
    | "SUCCESS"
    | "ERROR"
    | "TEMPORARY_ERROR";

  verdict?:
    | "SUPPORTED"
    | "FALSE"
    | "MISLEADING"
    | "UNVERIFIED";

  confidence?: number;

  summary?: string;

  reasoning?: string;

  sources?: Source[];
}
```

Source:

```typescript
interface Source {
  id: string;
  title: string;
  publisher?: string;
  url: string;
  publishedAt?: string;
  direction?:
    | "SUPPORTS"
    | "CONTRADICTS"
    | "CONTEXTUAL"
    | "UNCLEAR";
}
```

---

# 17. Loading State

Immediately after Verify:

```text
VERIFYING
    ↓
Loading Card
```

Example:

```text
┌──────────────────────────────┐
│ HaCha                        │
│                              │
│ Checking this claim...       │
│                              │
│ Retrieving evidence          │
│ and analyzing sources.       │
└──────────────────────────────┘
```

Prefer stage messages to fake percentages.

Do not display:

```text
73% complete
```

unless actual progress is measured.

Possible stages:

```text
Checking existing fact-checks...
Retrieving evidence...
Analyzing evidence...
Preparing result...
```

---

# 18. Result Card

The result card is the primary Phase 11 component.

```text
┌─────────────────────────────────────┐
│ HaCha                         ×     │
│                                     │
│ FALSE                               │
│ Confidence: High                    │
│                                     │
│ The claim conflicts with an         │
│ official source published on ...    │
│                                     │
│ [View Evidence]                     │
└─────────────────────────────────────┘
```

Hierarchy:

```text
HaCha
 ↓
VERDICT
 ↓
Confidence
 ↓
Explanation
 ↓
Evidence
```

The verdict should be immediately visible.

---

# 19. Verdict States

## SUPPORTED

```text
SUPPORTED

The available evidence directly supports
the central claim.

Confidence: High
```

## FALSE

```text
FALSE

The available evidence directly contradicts
the central claim.

Confidence: High
```

## MISLEADING

```text
MISLEADING

The claim contains a true element but omits
important context that changes its meaning.

Confidence: Medium
```

## UNVERIFIED

```text
UNVERIFIED

The available evidence is insufficient to
establish whether the claim is true or false.

Confidence: Low
```

---

# 20. System States Are Not Verdicts

Do not display:

```text
API failure → FALSE
```

or:

```text
No search results → FALSE
```

Keep factual verdicts separate from system states:

```text
LOADING
ERROR
TIMEOUT
```

versus:

```text
SUPPORTED
FALSE
MISLEADING
UNVERIFIED
```

---

# 21. Confidence Display

Avoid misleading presentation such as:

```text
91% TRUE
```

unless confidence has been properly calibrated and the wording is explicitly defined.

Prefer:

```text
Confidence: High
```

or:

```text
Confidence: 91%
```

with a tooltip explaining that confidence represents the strength of the available evidence and reasoning, not a guaranteed probability of truth.

---

# 22. Confidence Validation

If:

```text
confidence < 0
```

or:

```text
confidence > 1
```

do not render the value blindly.

Use:

```text
Confidence unavailable
```

or treat the response as invalid.

---

# 23. Explanation Rendering

The backend explanation should be treated as untrusted text.

Prefer:

```text
textContent
```

or safe DOM construction.

Do not insert LLM output directly with:

```javascript
innerHTML
```

The MVP should render explanations as plain text.

---

# 24. Evidence Panel

Keep the initial card compact.

When the user clicks:

```text
View Evidence
```

expand:

```text
┌──────────────────────────────────────┐
│ Evidence                         ×   │
│                                      │
│ [E1] Official Source                 │
│ Publisher                            │
│ Published: Aug 10, 2026              │
│                                      │
│ Relevant evidence excerpt...         │
│                                      │
│ [Open Source]                        │
│                                      │
│ [E2] Independent News                │
│ ...                                  │
└──────────────────────────────────────┘
```

Show the evidence direction where useful:

```text
SUPPORTS
CONTRADICTS
CONTEXTUAL
```

---

# 25. Source Links

Source URLs must come from validated backend metadata.

Never use URLs generated by the LLM.

Correct flow:

```text
LLM
 ↓
"E1"
 ↓
Backend resolves E1
 ↓
Validated source URL
 ↓
Extension
```

The extension should not independently decide whether a source is trustworthy.

---

# 26. Evidence Ordering

Use the ordering supplied by the backend.

The UI should not arbitrarily reorder evidence because that can make the displayed evidence inconsistent with the reasoning pipeline.

---

# 27. Long Explanations

The compact result card should truncate long explanations.

Example:

```text
The available evidence indicates that...
[Read more]
```

Expanded view can show the complete explanation.

Do not allow unusually long model output to dominate the webpage.

---

# 28. Long Source Lists

Initially show a small number of high-ranked sources:

```text
Top 3–5
```

Then:

```text
View all sources
```

if necessary.

---

# 29. Overlay Positioning

The result card should appear close to the selected region.

Preferred order:

```text
1. Right
2. Left
3. Below
4. Above
```

Choose the first location with sufficient viewport space.

---

# 30. Position Calculation

Given:

```text
selection:
x
y
width
height

card:
width
height

viewport:
width
height
```

Calculate:

```text
right:
x + width + gap

left:
x - cardWidth - gap

below:
y + height + gap

above:
y - cardHeight - gap
```

Then check whether the candidate position fits.

---

# 31. Viewport Clamping

Keep a safe margin:

```text
8–16px
```

If:

```text
cardX < margin
```

use:

```text
cardX = margin
```

If:

```text
cardX + cardWidth > viewportWidth - margin
```

clamp it to:

```text
viewportWidth - cardWidth - margin
```

Apply the same logic vertically.

---

# 32. Selection Near an Edge

Example:

```text
┌─────────────────────────────┐
│ SELECTED │ RESULT           │
│ REGION   │ CARD             │
└─────────────────────────────┘
```

If the right side has insufficient space, automatically place the card on the left.

The user should not need to reposition it manually.

---

# 33. Scrolling

Scrolling can invalidate viewport-relative coordinates.

For the MVP:

```text
small scroll → reposition if practical
large scroll → optionally dismiss/reposition
```

The result should never appear detached from the selected content without an understandable reason.

---

# 34. Resize

Listen for:

```text
window.resize
```

and recalculate:

```text
viewport dimensions
card position
```

Throttle or debounce repeated events.

---

# 35. Browser Zoom

Use browser geometry APIs rather than hardcoded screen sizes.

Prefer:

```javascript
getBoundingClientRect()
```

and viewport measurements.

Test at:

```text
80%
100%
125%
150%
```

zoom levels.

---

# 36. Fixed and Sticky Page Elements

Websites may contain:

```text
sticky headers
fixed sidebars
floating widgets
```

The MVP should avoid obvious collisions where practical, but should not attempt to understand every webpage layout.

---

# 37. Iframes

Some pages render content inside iframes.

Cross-origin iframe security boundaries must not be bypassed.

If unsupported, document:

```text
Some cross-origin iframe content may not be selectable.
```

Do not weaken browser security to support it.

---

# 38. CSS and Visual Design

The result card should feel:

```text
compact
modern
professional
quiet
```

Avoid excessive:

```text
animations
gradients
large shadows
screen coverage
```

The goal is to enhance the browsing experience, not interrupt it.

---

# 39. Animations

Use subtle transitions:

```text
fade in
small slide
evidence expansion
```

Keep durations short.

Avoid animations that delay interaction.

---

# 40. Dark Mode

Support:

```text
prefers-color-scheme
```

or a future extension theme setting.

The card should remain readable on both:

```text
light webpages
dark webpages
```

---

# 41. Accessibility

Minimum requirements:

- Keyboard navigation.
- Visible focus states.
- ARIA labels.
- Accessible button names.
- Readable contrast.
- Text-based verdict.
- Keyboard-close support.
- Screen-reader-friendly source links.

Do not communicate verdicts using color alone.

---

# 42. Keyboard Controls

Recommended:

```text
Escape → cancel/close
Enter  → confirm when appropriate
Tab    → navigate controls
```

Do not capture keyboard events globally when they are not needed.

---

# 43. Close Behavior

Clicking:

```text
×
```

should clean up:

```text
result card
evidence panel
selection overlay
claim dialog
temporary state
```

and return to:

```text
IDLE
```

The webpage should return to its original state.

---

# 44. Event Listener Cleanup

Store listener references:

```typescript
const onMouseDown = ...
const onMouseMove = ...
const onMouseUp = ...
```

Remove them when the selection operation ends.

This is important because the extension can be activated repeatedly.

---

# 45. Canvas and Screenshot Cleanup

After OCR/capture:

```text
release temporary canvas/image resources
```

Do not retain large screenshots unnecessarily.

The image should not remain in memory after it is no longer needed.

---

# 46. Duplicate Root Prevention

Before creating the root:

```javascript
document.querySelector("#hacha-root")
```

If it exists:

```text
reuse or clean it
```

Never accumulate:

```text
#hacha-root
#hacha-root-2
#hacha-root-3
```

---

# 47. Request Correlation

Every verification request should have:

```text
requestId
```

Example:

```text
Request A → Claim A
Request B → Claim B
```

If A returns after B:

```text
Ignore A
```

when B is the active request.

---

# 48. Race Condition Example

```text
Verify Claim A
      ↓
Request A

Close

Verify Claim B
      ↓
Request B

Request A returns late
      ↓
Must NOT overwrite Claim B
```

The UI should verify:

```text
requestId
current state
active tab
```

before applying a response.

---

# 49. Multiple Tabs

Associate requests with the appropriate:

```text
tabId
requestId
```

where necessary.

Do not allow a response from one tab to modify another tab's UI.

---

# 50. Loading Timeout

Never leave:

```text
Checking...
```

indefinitely.

After the configured timeout:

```text
Verification is taking longer than expected.

[Try Again] [Close]
```

---

# 51. Error States

## Network Error

```text
HaCha could not reach the verification service.

Check your connection and try again.
```

## Temporary Service Error

```text
HaCha's verification service is temporarily unavailable.

[Try Again] [Close]
```

## OCR Error

```text
HaCha could not extract readable text.

Try selecting a clearer region.
```

Do not expose:

```text
stack traces
internal URLs
database errors
API credentials
```

---

# 52. UNVERIFIED vs ERROR

These must remain separate.

```text
UNVERIFIED
```

means:

```text
The verification process completed but evidence
was insufficient to establish the claim.
```

```text
ERROR
```

means:

```text
The verification process could not complete.
```

This distinction is essential for user trust.

---

# 53. Verification Method

If the backend provides:

```text
verification_method
```

the UI can optionally display:

```text
Previously checked
```

for cache results,

or:

```text
Existing fact-check
```

for known fact-check results,

or:

```text
Evidence-based AI analysis
```

for the RAG path.

This is optional but useful for transparency.

---

# 54. Privacy Messaging

The extension can communicate its local OCR architecture accurately:

```text
Image processing happens locally.
The extracted claim text is sent for verification.
```

Do not claim:

```text
Nothing leaves your browser
```

because the extracted claim is sent to the backend.

---

# 55. Performance

The UI must remain responsive during:

```text
OCR
network requests
result rendering
```

Use asynchronous operations.

If OCR becomes a major UI bottleneck, consider running Tesseract.js inside a:

```text
Web Worker
```

---

# 56. Avoid Excessive DOM Work

Do not rebuild the entire extension UI for every state change.

Prefer:

```text
create component
 ↓
update required fields
```

where practical.

---

# 57. Development Debug Mode

Optional development configuration:

```text
HACHA_DEBUG=true
```

can display:

```text
selection coordinates
state transitions
request IDs
API timing
position calculations
```

Production should disable verbose debugging.

---

# 58. Phase 11 Testing Matrix

Test at least:

### Page Types

```text
Plain HTML
Wikipedia
News sites
Documentation sites
Social-media-style pages
Long articles
Infinite-scroll pages
```

### Visual Conditions

```text
Light mode
Dark mode
Aggressive global CSS
Sticky headers
Fixed sidebars
Custom fonts
```

### Geometry

```text
Top-left selection
Top-right selection
Bottom-left selection
Bottom-right selection
Center selection
Tiny selection
Large selection
```

### Browser Conditions

```text
100% zoom
125% zoom
150% zoom
Small window
Large window
Resize during result
Scroll during result
```

---

# 59. Unit Tests

Test:

```text
State transitions
Position calculations
Viewport clamping
Verdict rendering
Confidence formatting
Source rendering
Request correlation
Cleanup
```

---

# 60. State Machine Tests

Verify:

```text
IDLE → SELECTING
SELECTING → CAPTURED
CAPTURED → OCR_PROCESSING
OCR_PROCESSING → CLAIM_CONFIRMATION
CLAIM_CONFIRMATION → VERIFYING
VERIFYING → RESULT
```

and:

```text
OCR_PROCESSING → ERROR
VERIFYING → ERROR
RESULT → IDLE
ERROR → IDLE
```

---

# 61. Positioning Tests

Test:

```text
selection in center
selection near right edge
selection near bottom edge
selection in bottom-right corner
```

Expected behavior:

```text
right
→ left
→ below
→ above
→ clamped
```

as appropriate.

---

# 62. Race Condition Tests

Test:

```text
Request A starts
Request B starts
B finishes
A finishes later
```

Expected:

```text
B remains displayed.
```

---

# 63. Security Tests for Phase 11

Even though Phase 12 is dedicated to hardening, the UI must already:

- [ ] Avoid `eval()`.
- [ ] Avoid `new Function()`.
- [ ] Avoid unsafe `innerHTML`.
- [ ] Render backend text safely.
- [ ] Never trust LLM-generated URLs.
- [ ] Avoid API keys in content scripts.
- [ ] Avoid sensitive console logging.
- [ ] Clean temporary images/canvas data.
- [ ] Validate response structure.
- [ ] Ignore stale responses.

---

# 64. Recommended Development Order

```text
Step 1
Create UI root
        ↓
Step 2
Add Shadow DOM
        ↓
Step 3
Implement state machine
        ↓
Step 4
Connect selection state
        ↓
Step 5
Build claim confirmation
        ↓
Step 6
Connect OCR output
        ↓
Step 7
Connect background messaging
        ↓
Step 8
Connect verification API
        ↓
Step 9
Build loading state
        ↓
Step 10
Build result card
        ↓
Step 11
Build evidence panel
        ↓
Step 12
Add source links
        ↓
Step 13
Implement contextual positioning
        ↓
Step 14
Implement viewport collision handling
        ↓
Step 15
Implement scroll/resize handling
        ↓
Step 16
Implement error/timeout states
        ↓
Step 17
Implement cleanup
        ↓
Step 18
Add accessibility
        ↓
Step 19
Test multiple websites
        ↓
Step 20
Phase 11 validation
```

---

# 65. Suggested Git Commits

```text
feat(extension): add hacha ui root
feat(extension): isolate ui with shadow dom
feat(extension): add ui state machine
feat(extension): connect selection state
feat(extension): add claim confirmation dialog
feat(extension): add editable ocr confirmation
feat(extension): connect verification messaging
feat(extension): add verification loading state
feat(extension): add result card
feat(extension): add verdict rendering
feat(extension): add evidence panel
feat(extension): add validated source links
feat(extension): add contextual result positioning
feat(extension): add viewport collision handling
feat(extension): handle scroll and resize
feat(extension): add verification error states
feat(extension): add request correlation
feat(extension): add ui cleanup
feat(extension): add accessibility support
test(extension): add state machine tests
test(extension): add positioning tests
test(extension): add response rendering tests
test(extension): add request race tests
docs(extension): document contextual overlay architecture
```

---

# 66. Phase 11 Exit Criteria

Phase 11 is complete when:

- [ ] User can activate HaCha.
- [ ] User can draw a selection.
- [ ] Selection is visually clear.
- [ ] OCR result appears.
- [ ] OCR text is editable.
- [ ] User can cancel.
- [ ] User can verify.
- [ ] Background service worker sends the request.
- [ ] Correct tab receives the response.
- [ ] Loading state works.
- [ ] All four verdicts render.
- [ ] Confidence renders safely.
- [ ] Explanation renders safely.
- [ ] Evidence panel works.
- [ ] Source links work.
- [ ] Result card appears near the selection.
- [ ] Viewport overflow is handled.
- [ ] Scroll behavior is acceptable.
- [ ] Resize behavior is acceptable.
- [ ] Webpage CSS does not break HaCha.
- [ ] HaCha CSS does not break the webpage.
- [ ] Error states work.
- [ ] Timeout states work.
- [ ] Stale responses are ignored.
- [ ] Closing cleans up the extension UI.
- [ ] Repeated activation does not create duplicate roots.
- [ ] Keyboard accessibility works.
- [ ] Basic screen-reader accessibility works.
- [ ] The flow works on multiple real websites.

---

# 67. Definition of Done

The final Phase 11 experience should feel like:

```text
                    USER
                      │
                      ▼
              Select suspicious claim
                      │
                      ▼
                  Local OCR
                      │
                      ▼
               Confirm / Edit
                      │
                      ▼
                    Verify
                      │
                      ▼
                 Checking...
                      │
                      ▼
        ┌─────────────────────────┐
        │ HaCha              ×    │
        │                         │
        │ FALSE                   │
        │ Confidence: High        │
        │                         │
        │ Evidence contradicts    │
        │ the central claim...    │
        │                         │
        │ [View Evidence]         │
        └─────────────────────────┘
```

The user should understand the result **without leaving the webpage**.

---

# 68. Phase 11 → Phase 12 Handoff

After Phase 11, the complete user-facing verification pipeline is operational:

```text
Browser
  ↓
Selection
  ↓
Local OCR
  ↓
Claim Confirmation
  ↓
Node Gateway
  ↓
Redis / Fact Check / Retrieval / RAG / LLM
  ↓
Validated Verdict
  ↓
Contextual Overlay
```

Phase 12 will harden every trust boundary:

```text
Chrome Extension
       ↓
Node Gateway
       ↓
Redis / MongoDB
       ↓
Python AI Service
       ↓
Search Providers
       ↓
Retrieved Web Content
       ↓
LLM
```

with focus on:

```text
Input validation
Authentication
Rate limiting
XSS
SSRF
Prompt injection
Secret management
Database security
Container security
Privacy
Abuse prevention
```

---

# 69. Final Phase 11 Summary

Phase 11 transforms HaCha from:

```text
A backend verification system
```

into:

```text
A usable browser fact-checking extension.
```

The key product flow is:

```text
SELECT
  ↓
OCR LOCALLY
  ↓
CONFIRM / EDIT
  ↓
VERIFY
  ↓
SHOW RESULT
  ↓
INSPECT EVIDENCE
```

The most important principle is:

> **Fact-checking should feel as simple as selecting text with a snipping tool, while the underlying verification remains evidence-grounded and transparent.**

