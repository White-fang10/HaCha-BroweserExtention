# HaCha AI Fact Checker
## Phase 2 — Region Selection UI

> **Phase objective:** Transform the activated HaCha browser extension into an interactive screen-selection tool. The user should be able to activate HaCha, drag a rectangular region over arbitrary webpage content, see the selection boundaries in real time, and obtain a reliable representation of the selected region for the future OCR pipeline.

---

# 1. Phase Overview

Phase 2 introduces the first major interaction that defines HaCha AI's identity:

> **The user points to exactly what they want HaCha to verify.**

Instead of automatically scanning a webpage, HaCha enters a temporary selection mode.

The webpage becomes visually dimmed, while the user can drag a rectangular bounding box around:

- A social-media post
- A paragraph
- A headline
- Text inside an image
- A meme
- An infographic
- A portion of an article
- Any other visible region that contains a potentially verifiable claim

The selected region is then prepared for the next phase.

The final Phase 2 workflow is:

```text
User clicks HaCha
        ↓
Content script activated
        ↓
Selection mode starts
        ↓
Page becomes dimmed
        ↓
User presses mouse button
        ↓
Selection begins
        ↓
User drags
        ↓
Bounding box follows cursor
        ↓
User releases mouse button
        ↓
Selection finalized
        ↓
Selected region captured
        ↓
Preview shown
        ↓
Ready for Phase 3 OCR
```

---

# 2. Why Region Selection Is Central to HaCha

The region-selection mechanism is not just a UI feature.

It is a core architectural decision.

Traditional automated systems may attempt:

```text
Entire webpage
       ↓
Find all text
       ↓
Find all images
       ↓
Analyze everything
```

HaCha instead uses:

```text
Entire webpage
       ↓
Human identifies suspicious content
       ↓
Only selected region
       ↓
Verification
```

This provides:

- Lower processing requirements
- Less unnecessary data collection
- Better user control
- Reduced false-positive opportunities
- Platform independence
- A simpler interaction model

The user effectively tells the system:

> **"Check this."**

---

# 3. Phase 2 Goals

By the end of Phase 2, the extension should support:

- Entering selection mode
- Displaying a full-page selection overlay
- Dimming the webpage
- Drawing a rectangular selection
- Live selection resizing
- Accurate mouse-coordinate tracking
- Selection minimum-size validation
- Selection cancellation
- Selection completion
- Selected-region coordinate calculation
- Device-pixel-ratio handling
- Scroll-aware coordinate handling
- Selection preview
- Basic capture of the selected region
- Cleanup after selection
- Repeated selection without duplicated listeners
- A clean interface ready for Phase 3 OCR

---

# 4. What Phase 2 Does NOT Implement

Do not implement the actual OCR pipeline yet.

Specifically, Phase 2 should not include:

```text
❌ Tesseract.js
❌ WebAssembly OCR
❌ Text extraction
❌ Claim normalization
❌ Redis
❌ Backend verification
❌ Fact-check APIs
❌ RAG
❌ LLM inference
❌ Final verdict UI
```

The output of Phase 2 is an image/region representation that Phase 3 can pass to Tesseract.js.

---

# 5. Phase 2 Architecture

The browser-side architecture becomes:

```text
                     Chrome Extension
                           │
                           ▼
                    Service Worker
                           │
                           ▼
                    Content Script
                           │
                           ▼
                  Selection Manager
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           Overlay       Canvas      Coordinates
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                    Selected Region
                           │
                           ▼
                    Preview / Image
                           │
                           ▼
                  Phase 3: Local OCR
```

---

# 6. Recommended Extension Structure

Extend the Phase 1 structure:

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
│   │   └── ui/
│   │       └── selection-toolbar.ts
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
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

The structure can be simplified if the implementation remains small, but separating selection responsibilities will make Phase 3 and Phase 11 easier.

---

# 7. Selection State Machine

The selection system should be treated as a state machine rather than a collection of mouse handlers.

Recommended states:

```text
INACTIVE
   │
   │ activate
   ▼
SELECTING
   │
   ├───────────────┐
   │               │
   │ mouse down    │ cancel
   ▼               ▼
DRAWING          INACTIVE
   │
   │ mouse up
   ▼
SELECTED
   │
   ├───────────────┐
   │               │
   │ confirm       │ cancel
   ▼               ▼
CAPTURING       INACTIVE
   │
   ▼
PREVIEW
```

Later, Phase 3 can extend this to:

```text
PREVIEW
   ↓
OCR_PROCESSING
   ↓
OCR_RESULT
```

---

# 8. Selection Manager

Create a central controller such as:

```text
SelectionManager
```

Its responsibilities:

- Start selection mode
- Stop selection mode
- Attach event listeners
- Remove event listeners
- Track selection state
- Calculate coordinates
- Update the selection rectangle
- Finalize the selection
- Trigger capture
- Clean up DOM elements

It should be the single authority responsible for selection lifecycle.

Avoid having the popup, content script, and overlay each independently manage selection state.

---

# 9. Entering Selection Mode

When Phase 1 sends:

```text
ACTIVATE_HACHA
```

the content script should call something conceptually similar to:

```text
selectionManager.start()
```

The manager then:

1. Creates the overlay.
2. Adds selection styles.
3. Registers pointer/mouse listeners.
4. Changes the cursor.
5. Displays a small instruction.

Example:

```text
Select a claim to verify
Drag around the content you want to check
Press Esc to cancel
```

---

# 10. Full-Page Overlay

The selection system should create a temporary overlay above the webpage.

Conceptually:

```text
┌──────────────────────────────────────────┐
│                WEBPAGE                   │
│                                          │
│   ┌──────────────────────────────┐       │
│   │                              │       │
│   │       Selected region        │       │
│   │                              │       │
│   └──────────────────────────────┘       │
│                                          │
│     Everything else is dimmed            │
│                                          │
└──────────────────────────────────────────┘
```

The overlay should:

- Cover the visible viewport
- Appear above webpage content
- Avoid changing page layout
- Avoid causing scrollbars
- Be removed completely after selection

---

# 11. Overlay Layering

The extension needs a very high stacking level to avoid being hidden behind webpage elements.

A high `z-index` should be used, but the exact value should be centralized rather than scattered through CSS.

For example:

```text
HAcha overlay z-index
        ↓
Large positive value
```

Avoid assuming that a single arbitrary z-index will work against every site.

The extension should create its UI in a controlled container.

---

# 12. Shadow DOM Consideration

A major issue with browser extensions is webpage CSS interference.

A webpage might have CSS such as:

```css
* {
    box-sizing: border-box;
}

div {
    font-family: ...
}

button {
    ...
}
```

Those styles can unintentionally affect the HaCha interface.

A strong approach is to place the extension UI inside a **Shadow DOM**.

Conceptually:

```text
Webpage DOM
│
├── Facebook/Google/News site DOM
│
└── HaCha Host
      │
      └── Shadow Root
            ├── Overlay
            ├── Selection rectangle
            └── Toolbar
```

This isolates HaCha's styles from most webpage CSS.

For Phase 2, Shadow DOM is recommended for the selection UI.

---

# 13. Dimming the Webpage

The overlay should visually dim the webpage.

For example:

```text
rgba(0, 0, 0, 0.45)
```

The exact visual design can be adjusted later.

The key requirement is:

```text
Selected area → visually clear
Everything else → visually dimmed
```

This creates the familiar "snipping tool" interaction.

---

# 14. Selection Rectangle

When the user presses the mouse button and moves the cursor:

```text
Start point
     ↓
Current cursor
     ↓
Rectangle
```

Example:

```text
start
  ●─────────────────────┐
  │                     │
  │                     │
  │        SELECT       │
  │                     │
  │                     │
  └─────────────────────●
                      current
```

The rectangle should update continuously while the pointer moves.

---

# 15. Mouse Coordinates

When selection starts, record:

```text
startX
startY
```

When the pointer moves:

```text
currentX
currentY
```

The rectangle should be calculated as:

```text
left   = min(startX, currentX)
top    = min(startY, currentY)

width  = abs(currentX - startX)
height = abs(currentY - startY)
```

Using `min()` and `abs()` is important because users may drag:

```text
top-left → bottom-right
```

or:

```text
bottom-right → top-left
```

Both directions must work.

---

# 16. Pointer Events vs Mouse Events

Although the initial plan mentions mouse events, a modern implementation should strongly consider **Pointer Events**.

Instead of relying only on:

```text
mousedown
mousemove
mouseup
```

consider:

```text
pointerdown
pointermove
pointerup
pointercancel
```

This provides a more unified interaction model and can later support:

- Mouse
- Stylus
- Touch-capable devices

For a desktop Chrome extension, mouse interaction remains the primary target, but Pointer Events provide a cleaner foundation.

---

# 17. Preventing Page Interaction

While selection mode is active, webpage interaction should be minimized.

For example, clicking a webpage button should not accidentally activate it.

The selection layer should intercept the relevant pointer events.

However, avoid globally disabling every browser interaction unless necessary.

The intended behavior is:

```text
Selection mode active
        ↓
Pointer interaction belongs to HaCha
```

After selection mode ends:

```text
Normal webpage interaction restored
```

---

# 18. Cursor

During selection mode, use a crosshair-style cursor:

```text
cursor: crosshair;
```

This gives an immediate visual indication that the browser is waiting for a region selection.

After selection mode exits, restore the normal cursor.

---

# 19. Minimum Selection Size

Users may accidentally click without dragging.

For example:

```text
width = 2px
height = 3px
```

This should not become an OCR request.

Define a minimum selection size.

Example:

```text
minimum width  = 20px
minimum height = 20px
```

If the selection is too small:

```text
Selection too small.
Please select a larger region.
```

The exact threshold can be adjusted after usability testing.

---

# 20. Selection Coordinates

The system should store a structured representation:

```typescript
interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

But there is an important distinction:

### Viewport coordinates

Relative to the visible browser viewport.

### Document coordinates

Relative to the entire webpage.

### Screenshot coordinates

Relative to the captured image.

These must not be mixed.

---

# 21. Coordinate System Strategy

During Phase 2, standardize the internal representation.

Use:

```text
Viewport coordinates
```

for the live selection rectangle.

Then convert to document/screenshot coordinates only when needed.

This prevents bugs caused by scrolling.

Example:

```text
Viewport:
x = 300
y = 200

Scroll:
scrollX = 0
scrollY = 800

Document:
x = 300
y = 1000
```

---

# 22. Scroll Handling

The selection UI should behave correctly when the page is scrolled.

At minimum:

- The overlay should remain fixed to the viewport.
- Coordinates should be calculated relative to the viewport.
- The selected region should remain correctly associated with the visible content.

If scrolling during selection is not supported initially, disable or carefully constrain it while selecting.

Do not silently produce incorrect coordinates.

---

# 23. Browser Zoom

Browser zoom can affect coordinate calculations.

The system should avoid assuming:

```text
CSS pixels == screenshot pixels
```

They may differ.

Therefore, the architecture should preserve enough information to perform later scaling.

Store:

```text
devicePixelRatio
viewportWidth
viewportHeight
selectionRect
```

when the selection is finalized.

---

# 24. Device Pixel Ratio

A display may have:

```text
devicePixelRatio = 1
```

or:

```text
devicePixelRatio = 1.25
devicePixelRatio = 1.5
devicePixelRatio = 2
```

This matters when converting the selection into an image.

For example:

```text
CSS selection:
400 × 200

DPR = 2

Potential image size:
800 × 400
```

Phase 2 should capture this metadata even if final image scaling is refined in Phase 3.

---

# 25. Selection Metadata

When the user finishes selecting, produce a structured object such as:

```json
{
  "x": 320,
  "y": 180,
  "width": 540,
  "height": 220,
  "devicePixelRatio": 1.25,
  "viewportWidth": 1920,
  "viewportHeight": 1080
}
```

This is not yet a verification request.

It is browser-side selection metadata.

---

# 26. Selection Preview

After the user releases the mouse button, do not immediately send anything to the backend.

Instead, show a small preview/action interface.

Example:

```text
┌─────────────────────────────────────┐
│        Selected region              │
│                                     │
│       [ cropped preview ]           │
│                                     │
│      ┌──────────┐  ┌──────────┐    │
│      │ Continue │  │ Cancel   │    │
│      └──────────┘  └──────────┘    │
└─────────────────────────────────────┘
```

The exact confirmation UX can evolve in Phase 3.

For Phase 2, the main purpose is to prove that the selected region is correct.

---

# 27. Capture Strategy

There are two important concepts here:

### Selection geometry

Where the user selected.

### Actual image capture

The pixels inside that selection.

Phase 2 should establish both, but avoid overcommitting to a capture mechanism that depends on the webpage DOM.

---

# 28. Important Capture Constraint

Do not assume that:

```text
HTML element → Canvas → Image
```

will work for arbitrary webpages.

The user may select:

- Text
- Images
- Canvas elements
- Videos
- Cross-origin content
- Complex browser-rendered UI

Therefore, `html2canvas` is not automatically a perfect solution.

It can fail or render differently from what the user sees.

---

# 29. Preferred Long-Term Capture Model

For a true "snipping tool" experience, the most reliable architecture is generally:

```text
Visible browser tab
       ↓
Browser screenshot capability
       ↓
Full visible screenshot
       ↓
Crop using selection coordinates
       ↓
Selected image
```

The extension can use the appropriate Chrome screenshot API from its privileged extension context, then crop the resulting image.

This is preferable to relying solely on DOM reconstruction.

---

# 30. Screenshot Permission and API Design

The screenshot mechanism should be designed carefully because Chrome extension APIs have specific permission and execution-context requirements.

Phase 2 should therefore isolate screenshot functionality behind an interface such as:

```text
SelectionCaptureService
```

rather than scattering screenshot API calls throughout the selection manager.

Conceptually:

```text
SelectionManager
       │
       ▼
SelectionCaptureService
       │
       ▼
Chrome screenshot API
```

This allows the implementation to be changed without rewriting the selection UI.

---

# 31. Recommended Phase 2 Capture Flow

The desired architecture is:

```text
User selection
      ↓
SelectionRect
      ↓
Capture request
      ↓
Background/service worker
      ↓
Visible-tab screenshot
      ↓
Image returned
      ↓
Crop SelectionRect
      ↓
Selected image
      ↓
Preview
```

The actual screenshot API implementation should be validated against the Chrome extension context during development.

---

# 32. Why Not Send the Screenshot to the Backend?

Do not send it to the backend.

The future privacy architecture is:

```text
Selected pixels
      ↓
Local image
      ↓
Local OCR
      ↓
Extracted text
      ↓
Backend
```

not:

```text
Selected pixels
      ↓
Backend
      ↓
OCR
```

This distinction is one of HaCha's major privacy advantages.

---

# 33. Selection Cancellation

Users should be able to cancel selection.

Recommended:

```text
ESC
```

should cancel.

Also provide a visible cancel action if a confirmation toolbar is displayed.

Cancellation should:

- Remove overlay
- Remove selection rectangle
- Remove listeners
- Clear selection state
- Restore cursor
- Restore webpage interaction

---

# 34. Cleanup

Cleanup is critical.

When selection mode ends, all dynamically created resources should be removed.

For example:

```text
SelectionManager.stop()
       ↓
Remove event listeners
       ↓
Remove overlay
       ↓
Remove toolbar
       ↓
Clear selection state
       ↓
Restore cursor
       ↓
Return to INACTIVE
```

Failure to clean up will cause bugs such as:

```text
One click → two selection boxes
Two clicks → four listeners
```

---

# 35. Repeated Selection

The user should be able to:

```text
Activate
 ↓
Select
 ↓
Cancel
 ↓
Select again
```

without refreshing the page.

This should be explicitly tested.

---

# 36. Keyboard Accessibility

Although mouse selection is the primary interaction, basic keyboard handling should be implemented.

At minimum:

```text
ESC → cancel selection
```

Later phases can add:

- Enter → confirm
- Tab → navigate controls
- Arrow keys → adjust selection
- Accessible labels

Do not over-engineer keyboard selection during Phase 2.

---

# 37. Mobile/Touch Consideration

HaCha is initially designed for desktop Chrome.

Touch support is not required for the Phase 2 exit criteria.

However, using Pointer Events rather than only mouse events makes future support easier.

---

# 38. Webpage Compatibility

Test the selection system on different types of pages:

### Simple HTML

```text
Wikipedia-like article
```

### News site

```text
Headline + article text
```

### Social media

```text
Post with text
```

### Image-heavy page

```text
Meme / infographic
```

### Dynamic page

```text
Single-page application
```

### Long page

```text
Page with substantial scrolling
```

The selection system should not depend on any particular website's DOM structure.

---

# 39. Website CSS Isolation

The selection overlay should not inherit styles such as:

```css
font-size
button styles
line-height
box-sizing
transform
position
```

from the host webpage.

Shadow DOM is recommended.

If Shadow DOM is not used, all extension CSS should be namespaced aggressively.

---

# 40. Visual Design

The Phase 2 UI should prioritize usability rather than final branding.

Recommended visual hierarchy:

```text
Background:
Dark transparent overlay

Selection:
Clear border

Selection interior:
Normal visibility

Instruction:
Small floating toolbar

Cursor:
Crosshair
```

The exact colors, shadows, animations, and typography can be refined later.

---

# 41. Selection Toolbar

A small toolbar can appear near the selection.

Example:

```text
┌─────────────────────────────┐
│ Drag to select a claim      │
│ ESC to cancel               │
└─────────────────────────────┘
```

After selection:

```text
┌─────────────────────────────┐
│ Region selected             │
│                             │
│ [ Continue ] [ Cancel ]     │
└─────────────────────────────┘
```

Avoid covering the selected claim.

The toolbar should reposition itself if the selected region is close to a viewport edge.

---

# 42. Selection Handles

For Phase 2, a simple rectangle is sufficient.

Optional resize handles can be added later:

```text
●──────────────●
│              │
│              │
│              │
●──────────────●
```

However, resize handles are not required for the initial exit criteria.

Prioritize reliable mouse-drag selection first.

---

# 43. Capture Quality

The selected image should preserve enough resolution for OCR.

Important factors:

```text
Image width
Image height
Device pixel ratio
Browser zoom
Original text size
```

Do not aggressively downscale the screenshot before Phase 3.

OCR accuracy can depend heavily on character size.

---

# 44. Phase 2 Internal Data Model

A useful internal representation is:

```typescript
interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionContext {
  rect: SelectionRect;
  devicePixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  timestamp: number;
}
```

The `timestamp` can help with debugging and later performance measurements.

---

# 45. Selection Lifecycle API

The internal API could conceptually look like:

```text
selectionManager.start()

selectionManager.getState()

selectionManager.cancel()

selectionManager.confirm()

selectionManager.stop()
```

And:

```text
selectionCapture.capture(context)
```

This keeps the code modular.

---

# 46. Testing the Geometry

Selection geometry deserves dedicated unit tests.

Example:

### Normal drag

```text
Start: 100,100
End:   500,400

Result:
x = 100
y = 100
width = 400
height = 300
```

### Reverse drag

```text
Start: 500,400
End:   100,100

Result:
x = 100
y = 100
width = 400
height = 300
```

### Horizontal-only movement

```text
Start: 100,200
End:   500,200

height = 0
```

This should be rejected by minimum-size validation.

### Negative coordinates

If browser/window geometry creates unusual coordinate conditions, normalization must still produce a valid rectangle.

---

# 47. Capture Testing

Test at different:

```text
Browser zoom levels
Device pixel ratios
Viewport sizes
Scroll positions
```

Example:

```text
100% zoom
125% zoom
150% zoom
```

The selected pixels should correspond to the region the user visually selected.

---

# 48. Performance Considerations

The selection rectangle should update smoothly.

Do not perform expensive screenshot processing on every:

```text
pointermove
```

Instead:

```text
pointermove
     ↓
Update lightweight geometry
     ↓
requestAnimationFrame
     ↓
Render rectangle
```

This prevents unnecessary layout/render work.

---

# 49. Avoid Layout Thrashing

Do not repeatedly query and modify layout in a tight loop.

Avoid patterns such as:

```text
read layout
write style
read layout
write style
read layout
```

Instead:

```text
Calculate coordinates
      ↓
Batch visual updates
      ↓
Render
```

This becomes important on complex social-media pages.

---

# 50. Selection Overlay Performance Target

The selection interaction should feel instantaneous.

Recommended qualitative target:

```text
Pointer movement
      ↓
No visible lag
```

The system should not perform OCR or network operations while the user is drawing.

Only geometry should update.

---

# 51. Security Considerations

The selection system executes inside arbitrary webpages.

Therefore:

- Do not trust webpage DOM content.
- Do not execute selected text as code.
- Do not inject user-selected text into HTML unsafely.
- Avoid `eval`.
- Avoid dynamic script execution.
- Keep extension UI isolated.
- Treat captured webpage pixels as untrusted data.

---

# 52. Privacy Considerations

Phase 2 should still maintain the project's privacy model.

During selection:

```text
Image
 ↓
Remains local
```

No network request should be generated merely because the user selected a region.

You should be able to verify this using:

```text
Chrome DevTools
→ Network
```

The extension should not upload the screenshot.

---

# 53. Network Verification Test

A useful Phase 2 test:

1. Open Chrome DevTools.
2. Open the Network tab.
3. Activate HaCha.
4. Draw a selection.
5. Finish selection.
6. Inspect network requests.

Expected:

```text
No screenshot upload
No OCR API request
No backend verification request
```

Phase 3 should still maintain the same property.

---

# 54. Phase 2 Demonstration Scenario

A good demo is:

```text
Open a news article
       ↓
Click HaCha
       ↓
Screen darkens
       ↓
Crosshair appears
       ↓
Drag around headline
       ↓
Rectangle follows cursor
       ↓
Release mouse
       ↓
Selected region highlighted
       ↓
Preview appears
       ↓
Click Cancel
       ↓
Page returns to normal
```

Then repeat:

```text
Activate
 ↓
Select another region
 ↓
Preview
```

No page refresh should be required.

---

# 55. Phase 2 Exit Criteria

Phase 2 is complete only when:

- [ ] HaCha can enter selection mode from Phase 1 activation.
- [ ] The webpage is visually dimmed during selection.
- [ ] A crosshair cursor is displayed.
- [ ] User can drag a rectangular selection.
- [ ] Selection works in all drag directions.
- [ ] Rectangle updates smoothly during pointer movement.
- [ ] Minimum selection size is enforced.
- [ ] ESC cancels selection.
- [ ] Cancel action cleans up the UI.
- [ ] Selection coordinates are normalized.
- [ ] Device-pixel-ratio metadata is captured.
- [ ] Viewport and scroll information are captured.
- [ ] Selection does not depend on webpage DOM structure.
- [ ] Extension UI is isolated from webpage CSS.
- [ ] Selection can be repeated without refreshing.
- [ ] No duplicate event listeners are created.
- [ ] Selected region can be captured or represented for the next phase.
- [ ] A preview of the selected region can be displayed.
- [ ] No screenshot is sent to a remote server.
- [ ] Selection remains responsive on normal webpages.
- [ ] No uncaught errors appear during normal use.

---

# 56. Definition of Done

The Phase 2 definition of done is:

```text
Open webpage
      ↓
Click HaCha
      ↓
Selection mode
      ↓
Draw rectangle
      ↓
Release
      ↓
Selected region captured
      ↓
Preview
      ↓
Cancel / Continue
      ↓
Clean exit
```

The browser should return to normal operation after the selection session ends.

---

# 57. Suggested Git Commits

Keep Phase 2 changes separated.

```text
feat(extension): add selection manager

feat(extension): add selection overlay

feat(extension): add pointer-based rectangle drawing

feat(extension): add selection geometry utilities

feat(extension): add selection cancellation

feat(extension): add selection metadata

feat(extension): add screenshot capture abstraction

feat(extension): add selected-region preview

test(extension): add selection geometry tests

test(extension): add selection lifecycle tests

docs(extension): document region selection architecture
```

---

# 58. Phase 2 Deliverables

At the end of Phase 2, the extension should contain:

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
│   │   └── ui/
│   │       └── selection-toolbar.ts
│   │
│   ├── popup/
│   └── shared/
│
├── manifest.json
├── package.json
├── tsconfig.json
└── README.md
```

Some files may be combined if the implementation remains simple.

The architecture matters more than the exact number of files.

---

# 59. Phase 2 Success Metric

The simplest success metric is:

> **Can a user accurately select any visible claim on a normal webpage and obtain the corresponding image region without uploading the screenshot?**

If the answer is yes, Phase 2 has achieved its core purpose.

---

# 60. Phase 2 → Phase 3 Handoff

Phase 2 should produce an input that Phase 3 can consume.

The handoff should conceptually be:

```text
Phase 2
────────

Selected Region
      │
      ├── Image
      ├── Width
      ├── Height
      ├── Device Pixel Ratio
      └── Metadata
      │
      ▼
Phase 3
────────

Image Preprocessing
      ↓
Tesseract.js
      ↓
OCR Text
```

Phase 3 should therefore not need to understand mouse events, selection rectangles, or webpage interaction.

It should simply receive:

```text
Selected Image
```

and focus on extracting text accurately.

---

# 61. Recommended Development Order

Implement Phase 2 in this order:

```text
Step 1
Create SelectionManager
        ↓
Step 2
Create overlay
        ↓
Step 3
Add pointer events
        ↓
Step 4
Draw rectangle
        ↓
Step 5
Normalize geometry
        ↓
Step 6
Add ESC/cancel
        ↓
Step 7
Add cleanup
        ↓
Step 8
Add selection metadata
        ↓
Step 9
Implement screenshot/capture abstraction
        ↓
Step 10
Crop selected region
        ↓
Step 11
Show preview
        ↓
Step 12
Test different pages/zoom/scroll
        ↓
Step 13
Performance testing
        ↓
Step 14
Phase 2 exit validation
```

Do not start with screenshot capture.

First make the selection interaction completely reliable.

---

# 62. Important Technical Decision

For HaCha, the selection mechanism should remain **DOM-independent**.

Do not implement:

```text
Find the nearest <p>
Find Facebook post container
Find Twitter/X article
Find Instagram caption
```

The system should not care which website it is running on.

The abstraction should be:

```text
Visible screen
      ↓
User selects pixels
      ↓
HaCha captures pixels
```

This is one of the strongest architectural choices in the project.

---

# 63. Final Phase 2 Summary

Phase 2 creates the **digital snipping tool** that defines HaCha AI's user experience.

The completed system should allow a user to activate HaCha and visually select exactly the content they want verified. The extension should display a dimmed webpage, provide a responsive bounding box, correctly calculate the selected region, capture the relevant pixels locally, and provide a preview without sending the image anywhere.

The key principle remains:

> **HaCha does not decide what the user should verify. The user points to it. HaCha handles the verification pipeline afterward.**

At the end of this phase, the project has moved from:

```text
Phase 1
"HaCha can activate."
```

to:

```text
Phase 2
"HaCha can select exactly what the user wants to verify."
```

The next phase can then build the privacy-critical OCR pipeline:

```text
Phase 2
Selected Image
      ↓
Phase 3
Tesseract.js + WebAssembly
      ↓
Extracted Text
```
