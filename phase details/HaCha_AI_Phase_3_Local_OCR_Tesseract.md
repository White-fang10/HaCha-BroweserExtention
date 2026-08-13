# HaCha AI Fact Checker
## Phase 3 — Local OCR with Tesseract.js

> **Phase objective:** Add privacy-preserving, client-side OCR to HaCha so that text inside the region selected in Phase 2 can be extracted directly inside the browser using Tesseract.js and WebAssembly. No screenshot should be uploaded to the backend during this phase.

---

## 1. Phase Overview

Phase 3 connects the **visual selection system** from Phase 2 with the future **claim-verification pipeline**.

The workflow becomes:

```text
User selects region
        ↓
Image captured locally
        ↓
Image preprocessing
        ↓
Tesseract.js
        ↓
OCR text
        ↓
User confirmation
```

The key privacy principle is:

> **The image stays in the browser; only extracted text will eventually be sent for verification.**

Phase 3 should therefore be designed so that the selected image never needs to leave the user's device.

---

## 2. Goals

By the end of this phase, the extension should:

- Receive the selected image from Phase 2.
- Load Tesseract.js locally.
- Initialize an OCR worker.
- Load the required language data.
- Preprocess the selected image.
- Run OCR locally.
- Return OCR confidence information where available.
- Display extracted text to the user.
- Allow the user to confirm, edit, or reject the OCR result.
- Handle OCR failures gracefully.
- Avoid sending the image to a server.
- Reuse the OCR worker where practical.
- Measure OCR latency and quality.
- Produce a structured OCR result for later phases.

---

## 3. What Phase 3 Does NOT Implement

Do not implement:

```text
❌ Claim normalization
❌ SHA-256 hashing
❌ Redis caching
❌ Fact-check APIs
❌ Search APIs
❌ RAG
❌ LLM reasoning
❌ Verdict generation
❌ MongoDB persistence
❌ Production backend communication
```

The output is simply:

```text
Selected Image
       ↓
Local OCR
       ↓
Extracted Text
```

---

## 4. Architecture

```text
                    Chrome Extension
                           │
                           ▼
                    Selection Manager
                           │
                           ▼
                    Selected Image
                           │
                           ▼
                  Image Preprocessor
                           │
                           ▼
                    Tesseract.js
                           │
                    WebAssembly OCR
                           │
                           ▼
                    OCR Result
                           │
                 ┌─────────┴─────────┐
                 ▼                   ▼
             Raw Text            Confidence
                 │                   │
                 └─────────┬─────────┘
                           ▼
                    OCR Confirmation
                           │
                           ▼
                    Future Backend
```

---

## 5. Recommended Directory Structure

Extend the Phase 2 structure:

```text
extension/
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   ├── content-script.ts
│   │   │
│   │   ├── selection/
│   │   │   ├── selection-manager.ts
│   │   │   ├── selection-overlay.ts
│   │   │   ├── selection-state.ts
│   │   │   ├── selection-geometry.ts
│   │   │   └── selection-capture.ts
│   │   │
│   │   ├── ocr/
│   │   │   ├── ocr-manager.ts
│   │   │   ├── ocr-worker.ts
│   │   │   ├── image-preprocessor.ts
│   │   │   ├── ocr-types.ts
│   │   │   └── ocr-utils.ts
│   │   │
│   │   └── ui/
│   │       └── ocr-confirmation.ts
│   │
│   ├── popup/
│   ├── shared/
│   │   ├── messages.ts
│   │   └── types.ts
│   └── assets/
│
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

Keep OCR logic separate from selection logic so Phase 3 does not make Phase 2 difficult to maintain.

---

## 6. Tesseract.js

Tesseract.js provides browser-compatible OCR through JavaScript and WebAssembly.

Conceptually:

```text
Image
  ↓
Tesseract.js
  ↓
WebAssembly
  ↓
OCR Engine
  ↓
Text + Metadata
```

HaCha should use it as a **local processing component**, not a remote OCR API.

---

## 7. Chrome Extension Compatibility

Tesseract.js requires JavaScript, WebAssembly, workers, and language data.

Manifest V3 extension security policies must therefore be respected.

Do not assume a normal website setup can simply be copied into the extension.

The target architecture is:

```text
Extension
   ↓
Local JS
   ↓
Local WASM
   ↓
Approved local language assets
```

Avoid dynamically executing remote code.

---

## 8. Privacy Requirement

The selected image must remain local.

Do not implement:

```text
Selected image → HTTP POST → backend
```

or:

```text
Selected image → external OCR API
```

Instead:

```text
Selected image
      ↓
Tesseract.js
      ↓
OCR text
```

Only later, after user confirmation, should textual claim data cross the backend boundary.

---

## 9. OCR Worker

OCR can be computationally expensive, so it should not block the main UI thread.

Conceptually:

```text
Main Thread
     │
     │ OCR request
     ▼
OCR Worker
     │
     ▼
WebAssembly
     │
     ▼
OCR Result
     │
     ▼
Main Thread
```

This keeps selection and UI interactions responsive.

---

## 10. OCR Manager

Create an abstraction such as:

```text
OCRManager
```

Responsibilities:

- Initialize Tesseract worker
- Load language
- Process image
- Track progress
- Return results
- Handle errors
- Reuse worker
- Terminate worker when appropriate

The rest of the extension should use something like:

```text
OCRManager.recognize(image)
```

rather than knowing Tesseract internals.

---

## 11. OCR Worker Lifecycle

Avoid creating a new worker for every selection.

Prefer:

```text
First OCR
 ↓
Create worker
 ↓
Initialize
 ↓
Load language
 ↓
OCR

Next OCR
 ↓
Reuse worker
 ↓
OCR
```

Terminate it when the HaCha session ends or when controlled cleanup is required.

---

## 12. OCR State Machine

Use explicit states:

```text
UNINITIALIZED
      ↓
INITIALIZING
      ↓
READY
      ↓
PROCESSING
      ↓
READY
```

Errors should transition to:

```text
ERROR
```

The UI should distinguish:

```text
OCR loading
OCR processing
OCR complete
OCR failed
```

---

## 13. Progress UI

The first OCR may take longer because the worker and language data have to initialize.

Show meaningful states such as:

```text
Preparing OCR...
```

```text
Loading language model...
```

```text
Reading selected region...
```

Do not display fake precision such as `87.43%` unless the underlying progress data is meaningful.

---

## 14. Cold vs Warm OCR

Measure separately:

```text
Cold OCR latency
```

and:

```text
Warm OCR latency
```

The first request may include worker and language initialization, while subsequent requests can reuse the loaded worker.

These measurements will later support Phase 13 evaluation.

---

## 15. Language Strategy

For the MVP, start with:

```text
English
```

Do not load every language model at startup.

Later, HaCha can support:

```text
English
Tamil
Hindi
Malayalam
...
```

Language selection should eventually be configurable.

Automatic language detection is not required in Phase 3.

---

## 16. Image Preprocessing

Raw screenshots are not always ideal for OCR.

A reasonable initial pipeline is:

```text
Selected Image
      ↓
Resize if needed
      ↓
Grayscale
      ↓
Optional contrast adjustment
      ↓
Optional thresholding
      ↓
OCR
```

Do not apply every possible filter automatically. Excessive preprocessing can reduce accuracy.

---

## 17. Grayscale

Convert:

```text
RGB → Grayscale
```

This can reduce visual complexity and help OCR for normal text.

However, benchmark it rather than assuming it always improves accuracy.

---

## 18. Resize

Small text may benefit from upscaling.

For example:

```text
600 × 300
      ↓
1200 × 600
```

Do not upscale extremely large images unnecessarily because this increases memory usage.

---

## 19. Contrast

Improve separation between text and background where appropriate.

For example:

```text
gray text on light gray
      ↓
higher contrast
```

Keep preprocessing configurable so different strategies can be benchmarked.

---

## 20. Thresholding

Thresholding can convert a grayscale image into a simplified black/white representation.

It can help high-contrast text but can damage:

- Thin fonts
- Colored text
- Anti-aliased characters
- Text over complex backgrounds

Therefore, treat thresholding as optional.

---

## 21. Avoid Overprocessing

Do not start with:

```text
grayscale
+ blur
+ sharpen
+ threshold
+ edge detection
+ denoise
+ resize
```

Start simple:

```text
resize
→ grayscale
→ optional contrast
```

Add more processing only if evaluation shows an improvement.

---

## 22. OCR Input API

The OCR manager should accept a browser-compatible image representation, for example:

```typescript
recognize(
  image: Blob | ImageBitmap | HTMLCanvasElement
): Promise<OCRResult>
```

The exact type should match the capture implementation from Phase 2.

---

## 23. OCR Result Model

Use a structured result instead of returning only a string.

Example:

```typescript
interface OCRResult {
  text: string;
  confidence: number;
  processingTimeMs: number;
  language: string;
}
```

Optionally preserve:

- Word-level confidence
- Line-level data
- Bounding boxes
- Blocks

These may become useful later.

---

## 24. Preserve OCR Metadata

Example:

```json
{
  "text": "NASA confirms...",
  "confidence": 89.4,
  "language": "eng",
  "processingTimeMs": 1420
}
```

Do not immediately discard metadata.

It will help diagnose verification errors caused by poor OCR.

---

## 25. OCR Confidence vs Verification Confidence

These are completely different concepts.

For example:

```text
OCR confidence:
62%

Verification confidence:
91%
```

The verification confidence must never be treated as proof that the OCR was correct.

Both values should remain independent.

---

## 26. OCR Quality Gate

After OCR:

```text
OCR result
    ↓
Empty?
 ├─ Yes → Ask user to select again
 └─ No
      ↓
Too short?
 ├─ Yes → Ask user to select larger region
 └─ No
      ↓
Continue
```

Possible quality checks:

- Empty text
- Mostly punctuation
- Very few alphabetic characters
- Extremely low OCR confidence

---

## 27. OCR Confirmation UI

After OCR, display the extracted text:

```text
┌─────────────────────────────────────────┐
│ HaCha extracted:                        │
│                                         │
│ "NASA confirms Earth will experience    │
│ three days of darkness."                 │
│                                         │
│ OCR confidence: 91%                     │
│                                         │
│ Is this the claim you want to verify?   │
│                                         │
│ [ Verify ]       [ Select Again ]       │
└─────────────────────────────────────────┘
```

The Verify button should not perform fact checking yet. It should prepare the text for the next phase.

---

## 28. Why User Confirmation Matters

OCR can make a single critical error:

```text
20% → 70%
2026 → 2028
NASA → NSA
1.5 → 15
```

A verification engine could then produce a correct answer to the wrong claim.

Therefore:

```text
OCR
 ↓
Human review
 ↓
Verification
```

is safer than:

```text
OCR
 ↓
Automatic verdict
```

---

## 29. OCR Editing

Allow the user to correct the extracted text.

Example:

```text
┌───────────────────────────────────┐
│ Extracted claim                   │
│                                   │
│ [NASA confirms Earth will...]     │
│                                   │
│ [ Edit ]                          │
│                                   │
│ [ Verify ] [ Select Again ]       │
└───────────────────────────────────┘
```

Corrections become the input to future claim normalization.

---

## 30. Empty OCR

If no readable text is detected:

```text
No readable text found.

Try selecting a larger or clearer region.
```

Do not send an empty request to the backend.

---

## 31. Low-Confidence OCR

If OCR confidence is below a configurable threshold:

```text
OCR confidence is low.

The selected region may be difficult to read.

[ Try Again ] [ Continue Anyway ]
```

The threshold should be configurable.

---

## 32. Non-Text Images

If the user selects a photograph with no text:

```text
No readable text detected.

HaCha currently verifies textual claims.
```

Future versions can support image-level verification.

---

## 33. Mixed Content

A selection can contain:

```text
Meme
+ text
+ watermark
+ username
+ decorative text
```

Preserve the raw OCR result in Phase 3.

Filtering usernames, hashtags, and other noise belongs to Phase 5.

---

## 34. OCR Performance Metrics

Measure:

```text
Worker initialization time
Language loading time
Preprocessing time
OCR time
Total time
```

Example:

```text
Initialization: 850 ms
Preprocessing: 45 ms
OCR: 1320 ms
Total: 2215 ms
```

These numbers are illustrative; record actual measurements during development.

---

## 35. Memory Management

OCR may require significant memory.

Avoid retaining unnecessary copies of:

```text
Original screenshot
Processed image
Canvas
ImageData
OCR result
```

for longer than necessary.

Large selections should be constrained.

---

## 36. Selection Size Limits

Users can theoretically select huge regions.

Define a maximum image area:

```text
width × height ≤ configured maximum
```

If exceeded:

```text
Selected region is too large.
Please select a smaller area.
```

The exact threshold should be determined through testing.

---

## 37. OCR Worker Reuse

Recommended:

```text
First selection
 ↓
Initialize worker
 ↓
OCR

Second selection
 ↓
Reuse worker
 ↓
OCR
```

This reduces repeated initialization overhead.

---

## 38. Worker Cleanup

When the HaCha session ends:

```text
Stop OCR
 ↓
Terminate worker
 ↓
Release resources
```

Do not terminate and recreate it between every selection unless required.

---

## 39. Error Handling

Handle at least:

### Worker initialization

```text
Unable to initialize local OCR.
```

### Language loading

```text
OCR language data could not be loaded.
```

### Image processing

```text
Selected image could not be processed.
```

### OCR execution

```text
OCR failed. Please try again.
```

### Memory/size

```text
Selected region is too large.
Try selecting a smaller area.
```

Do not expose stack traces to users.

---

## 40. Development Logging

Use consistent logs:

```text
[HaCha][OCR] Worker initializing
[HaCha][OCR] Language loading
[HaCha][OCR] Worker ready
[HaCha][OCR] Processing started
[HaCha][OCR] Processing complete
[HaCha][OCR] Confidence: 91.2
[HaCha][OCR] Duration: 1420ms
```

This will help during later performance evaluation.

---

## 41. OCR Test Dataset

Create a local test set containing:

- Clear text
- Social-media screenshots
- News headlines
- Memes
- Low-contrast text
- Small text
- Mixed image/text
- Decorative fonts
- Text with numbers
- Text with dates
- Text with percentages
- Named entities

Do not use private screenshots without appropriate permission.

---

## 42. OCR Evaluation Metrics

Measure:

### Character Error Rate

```text
CER
```

### Word Error Rate

```text
WER
```

### OCR confidence

```text
Mean confidence
```

### Latency

```text
Average OCR processing time
```

### Success rate

```text
Successful OCR / total OCR attempts
```

---

## 43. Ground-Truth Testing

For each test image, store expected text.

Example:

```text
image:
claim-001.png

expected:
"Scientists discovered a new species."

OCR:
"Scientists discovered a new species."
```

Then compare expected and extracted text objectively.

---

## 44. Number Accuracy

Explicitly test:

```text
20% vs 70%
2026 vs 2028
1.5 vs 15
$100 vs $1000
5 km vs 50 km
```

Numbers are particularly important because OCR errors can completely change claim meaning.

---

## 45. Entity Accuracy

Test named entities such as:

```text
NASA
WHO
OpenAI
India
COVID-19
```

Errors in entities can lead to searches about the wrong subject.

---

## 46. Multiline Text

Preserve meaningful OCR line information where possible.

For example:

```text
NASA CONFIRMS
EARTH WILL EXPERIENCE
THREE DAYS OF DARKNESS
```

can later be normalized into a sentence.

Normalization belongs to Phase 5.

---

## 47. Phase 3 Internal Result

A useful model:

```typescript
interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTimeMs: number;
  characterCount: number;
  wordCount: number;
  source: "local-tesseract";
}
```

Future fields may include:

```text
blocks
lines
words
boundingBoxes
```

---

## 48. Internal Message Flow

The extension can use messages such as:

```text
SELECTION_COMPLETE
        ↓
OCR_START
        ↓
OCR_PROGRESS
        ↓
OCR_COMPLETE
        ↓
OCR_CONFIRMATION
```

Example:

```json
{
  "type": "OCR_COMPLETE",
  "result": {
    "text": "NASA confirms...",
    "confidence": 91.4,
    "language": "eng"
  }
}
```

---

## 49. User Experience Flow

The Phase 3 UX should be:

```text
1. Click HaCha
       ↓
2. Select region
       ↓
3. Region preview
       ↓
4. "Reading selected content..."
       ↓
5. OCR processing
       ↓
6. Extracted text appears
       ↓
7. User reviews text
       ↓
8. User can edit/select again
       ↓
9. Confirmed text becomes ready for backend
```

No fact-check API or LLM call is required yet.

---

## 50. Privacy Demonstration

Phase 3 should provide a strong project demonstration:

```text
Select claim
      ↓
Open DevTools
      ↓
Network tab
      ↓
Run OCR
      ↓
No screenshot upload
      ↓
Show extracted text
```

This demonstrates the privacy architecture rather than merely describing it.

---

## 51. Network Boundary

After Phase 3, the intended boundary is:

```text
LOCAL DEVICE
────────────────────────────
Selection
Screenshot
Preprocessing
OCR
OCR confirmation

                │
                │ future
                ▼

REMOTE SERVICES
────────────────────────────
Confirmed textual claim
Verification
Evidence retrieval
```

This boundary should remain stable throughout later development.

---

## 52. Security Considerations

OCR output is untrusted webpage-derived data.

Do not:

- Execute OCR text as JavaScript.
- Treat OCR text as HTML.
- Insert raw OCR text through unsafe HTML.
- Load executable code from arbitrary URLs.
- Trust OCR text as sanitized input.

Use safe DOM APIs for rendering text.

---

## 53. Phase 3 Exit Criteria

Phase 3 is complete when:

- [ ] Tesseract.js is integrated.
- [ ] OCR runs locally in the browser.
- [ ] Required WebAssembly assets work under Manifest V3.
- [ ] Required language data is available through the approved local extension asset strategy.
- [ ] Selected images are never sent to the backend.
- [ ] OCR does not unnecessarily block the main UI.
- [ ] OCR worker lifecycle is managed explicitly.
- [ ] OCR worker can be reused.
- [ ] Selected images can be processed.
- [ ] Basic preprocessing is implemented.
- [ ] OCR results use a structured model.
- [ ] OCR confidence is captured where available.
- [ ] OCR processing time is measured.
- [ ] Empty results are handled.
- [ ] Low-confidence results are handled.
- [ ] Users can review extracted text.
- [ ] Users can edit or reject OCR.
- [ ] Users can select again.
- [ ] Large selections are handled safely.
- [ ] OCR errors are handled gracefully.
- [ ] DevTools confirms screenshots are not uploaded.
- [ ] OCR works against the test dataset.
- [ ] Initial OCR accuracy and latency measurements are recorded.
- [ ] No secrets are embedded in the extension.
- [ ] OCR text is rendered safely.

---

## 54. Definition of Done

```text
Open webpage
      ↓
Activate HaCha
      ↓
Select claim
      ↓
Capture locally
      ↓
Preprocess image
      ↓
Tesseract.js
      ↓
Extract text
      ↓
Show OCR result
      ↓
User confirms/corrects
      ↓
Text ready for next phase
```

The selected screenshot remains local throughout the process.

---

## 55. Suggested Git Commits

```text
feat(extension): add tesseract.js dependency
feat(extension): add OCR worker manager
feat(extension): add local OCR language configuration
feat(extension): add image preprocessing pipeline
feat(extension): integrate OCR with selection flow
feat(extension): add OCR result model
feat(extension): add OCR progress state
feat(extension): add OCR confirmation UI
feat(extension): add OCR error handling
test(extension): add OCR utility tests
test(extension): add OCR evaluation dataset
docs(extension): document local OCR architecture
```

---

## 56. Phase 3 Deliverables

```text
extension/
│
├── src/
│   ├── background/
│   │
│   ├── content/
│   │   ├── selection/
│   │   │
│   │   ├── ocr/
│   │   │   ├── ocr-manager.ts
│   │   │   ├── ocr-worker.ts
│   │   │   ├── image-preprocessor.ts
│   │   │   ├── ocr-types.ts
│   │   │   └── ocr-utils.ts
│   │   │
│   │   └── ui/
│   │       └── ocr-confirmation.ts
│   │
│   ├── popup/
│   └── shared/
│
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## 57. Phase 3 → Phase 4/5 Handoff

The output should be a clean OCR result such as:

```json
{
  "text": "NASA confirms Earth will experience three days of darkness next month.",
  "confidence": 94.2,
  "language": "eng",
  "processingTimeMs": 1840,
  "source": "local-tesseract"
}
```

Later:

```text
OCR Result
    ↓
Claim Normalization
    ↓
Noise Removal
    ↓
Entity Extraction
    ↓
Date/Number Extraction
    ↓
Normalized Claim
    ↓
SHA-256 Hash
```

That processing belongs to Phase 5.

---

## 58. Recommended Development Order

```text
Step 1
Install and configure Tesseract.js
        ↓
Step 2
Validate WebAssembly/worker execution
        ↓
Step 3
Load English language model
        ↓
Step 4
Create OCRManager
        ↓
Step 5
Connect selected image to OCR
        ↓
Step 6
Implement preprocessing
        ↓
Step 7
Implement OCR result model
        ↓
Step 8
Add loading/progress states
        ↓
Step 9
Add OCR confirmation UI
        ↓
Step 10
Add retry/select-again flow
        ↓
Step 11
Add quality checks
        ↓
Step 12
Measure OCR latency
        ↓
Step 13
Evaluate OCR accuracy
        ↓
Step 14
Verify no screenshot leaves browser
        ↓
Step 15
Phase 3 exit validation
```

---

## 59. Important Technical Decision

Do not make OCR a black box.

HaCha should know:

```text
What image was processed?
What preprocessing was applied?
Which language was used?
How long did OCR take?
What confidence was returned?
How much text was extracted?
```

This information will make debugging and evaluation significantly easier.

---

## 60. Important Product Decision

Do not automatically trust OCR.

The correct architecture is:

```text
Image
 ↓
OCR
 ↓
Human review
 ↓
Claim normalization
 ↓
Verification
```

not:

```text
Image
 ↓
OCR
 ↓
Automatic verdict
```

This is especially important because a single OCR error in a number, date, organization, person, percentage, or unit can completely change a claim.

---

## 61. Final Phase 3 Summary

Phase 3 establishes HaCha's **local intelligence layer**.

The system now takes a region selected by the user and transforms its visual content into machine-readable text without uploading the screenshot.

The completed architecture is:

```text
                  USER
                    │
                    ▼
             Selects a region
                    │
                    ▼
             Local screenshot
                    │
                    ▼
            Image preprocessing
                    │
                    ▼
             Tesseract.js
                    │
               WebAssembly
                    │
                    ▼
               OCR result
                    │
             Human confirmation
                    │
                    ▼
             Confirmed claim
                    │
                    ▼
             Future backend
```

The key principle remains:

> **The browser handles the pixels; the verification system handles the claim.**

At the end of this phase:

```text
Phase 1
"HaCha can activate."
       ↓
Phase 2
"HaCha can select what the user wants checked."
       ↓
Phase 3
"HaCha can read the selected content locally without
sending the screenshot to a server."
```

The next major step is **Phase 4 — Backend Gateway Core**, where the confirmed textual claim can finally cross the browser/backend boundary and enter the server-side verification architecture.
