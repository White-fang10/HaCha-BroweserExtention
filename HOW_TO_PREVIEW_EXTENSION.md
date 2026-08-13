# Beginner's Guide: How to Preview and Test the HaCha Chrome Extension 🧩🚀

> **Welcome to Chrome Extension Development!**  
> This guide is tailored for beginners. It explains step-by-step how to load, preview, test, and debug the **HaCha AI Fact Checker** Chrome extension on your local machine using Google Chrome (or Edge / Brave / Vivaldi).

---

## 📑 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Building the Extension Source Code](#2-building-the-extension-source-code)
3. [Loading the Unpacked Extension in Chrome](#3-loading-the-unpacked-extension-in-chrome)
4. [How to Use and Test HaCha on a Webpage](#4-how-to-use-and-test-hacha-on-a-webpage)
5. [How to Debug Extension Components (Beginner-Friendly)](#5-how-to-debug-extension-components-beginner-friendly)
6. [Development Workflow & How to Reload Code Changes](#6-development-workflow--how-to-reload-code-changes)
7. [Troubleshooting Common Issues](#7-troubleshooting-common-issues)

---

## 1. Prerequisites

Before testing the extension, ensure you have:
- **Google Chrome** installed (or any Chromium-based browser like Microsoft Edge, Brave, or Opera).
- **Node.js** (`v18` or `v20+`) installed on your computer.

---

## 2. Building the Extension Source Code

Chrome extensions run HTML, CSS, JavaScript, and JSON configuration files. Since HaCha uses **TypeScript**, you need to build/compile TypeScript into JavaScript first.

1. Open your terminal / command prompt.
2. Navigate to the `extension` folder:
   ```bash
   cd extension
   ```
3. Install dependencies (if not already done):
   ```bash
   npm install
   ```
4. Run the build script:
   ```bash
   npm run build
   ```
   *This compiles TypeScript files from `src/` into runnable JavaScript files.*

---

## 3. Loading the Unpacked Extension in Chrome

Google Chrome allows developers to load local extensions directly without publishing them to the Chrome Web Store using **Developer Mode**.

### Step 3.1: Open the Extensions Page in Chrome
- Open Google Chrome.
- In the address bar (URL bar), type `chrome://extensions` and press **Enter**.
- Alternatively: Click the **puzzle piece icon** (🧩) in the top-right corner of Chrome -> click **Manage Extensions**.

```text
Chrome Address Bar:  chrome://extensions
```

### Step 3.2: Enable Developer Mode
- In the top-right corner of the Extensions page, locate the **Developer mode** toggle switch.
- Click the toggle switch to turn it **ON** (it should turn blue).

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Extensions                                     [ Developer mode: ON  ] │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 3.3: Load the Unpacked Extension
- Once Developer Mode is turned ON, three buttons will appear in the top-left toolbar:
  - **Load unpacked**
  - **Pack extension**
  - **Update**
- Click **Load unpacked**.
- A file chooser modal will open. Select the `extension` folder inside the HaCha project repository:
  `c:\Users\CSE LAB 1\Downloads\HaCha\extension`
- Click **Select Folder**.

🎉 **Congratulations!** You should now see the **HaCha AI Fact Checker** card appear on your Chrome Extensions page!

---

## 4. How to Use and Test HaCha on a Webpage

### Step 4.1: Pin the Extension to Toolbar
1. Click the **puzzle piece icon** (🧩) on the top-right Chrome toolbar.
2. Find **HaCha AI Fact Checker** in the dropdown menu.
3. Click the **Pin icon** (📌) next to it so the HaCha icon stays visible on your browser bar.

### Step 4.2: Open a Webpage & Activate Extension
1. Open any public website with text or news content (e.g., Wikipedia, a news article, or Twitter/X).
2. Click the **HaCha extension icon** in your toolbar.
3. The **HaCha Popup UI** will open.
4. Click the primary button: **"Activate HaCha"** (or **"Select Region"**).

### Step 4.3: Test Interactive Region Selection
1. The webpage will enter selection mode (the screen dims slightly).
2. Click and drag your mouse to draw a rectangular selection box over any headline, paragraph, or post.
3. Release the mouse button.
4. The selected region will be captured, and local WASM OCR (Tesseract.js) will process the text right inside your browser!
5. An interactive editable modal will appear displaying the extracted text.

---

## 5. How to Debug Extension Components (Beginner-Friendly)

Chrome extensions consist of 3 separate parts. Each part has its own Developer Tools window:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION ARCHITECTURE                   │
│                                                                        │
│   1. Popup UI          ──► Right-click Popup ──► Inspect               │
│   2. Content Script    ──► F12 on Webpage    ──► Console               │
│   3. Service Worker    ──► chrome://extensions ──► Inspect Views       │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Debugging the Popup Window
- Click the HaCha extension icon in Chrome toolbar.
- **Right-click** anywhere inside the extension popup window.
- Click **Inspect**.
- A standard Chrome DevTools window will open showing the popup HTML/CSS and console messages.

### 2. Debugging Content Scripts (Overlay, Selection Box, Local OCR)
- Content scripts run directly inside the active webpage.
- On any webpage where HaCha is active, press **F12** (or `Ctrl + Shift + I` / Right-click -> Inspect).
- Click the **Console** tab to see logs printed by HaCha content scripts.
- To inspect extension UI elements (like the result card), check the **Elements** tab and look for the `#hacha-shadow-root` container.

### 3. Debugging Background Service Worker
- Navigate to `chrome://extensions`.
- Find the **HaCha AI Fact Checker** card.
- Look for the line: `Inspect views: background page` or **`service worker`**.
- Click the blue link **`service worker`**.
- A dedicated DevTools window will open for the extension's background script. Here you can inspect network calls sent from the extension to the Express gateway backend.

---

## 6. Development Workflow & How to Reload Code Changes

When you edit files inside the `extension/` directory, Chrome will **NOT** automatically update the extension unless you reload it.

Follow this simple 3-step loop during development:

```text
1. Edit code in your editor (e.g. extension/src/...)
                  ↓
2. Run build:  `npm run build`  (or `npm run watch` for auto-compilation)
                  ↓
3. Go to `chrome://extensions` ──► Click the Refresh 🔄 icon on HaCha card
```

### Pro-Tip: Use Watch Mode
In your terminal inside `extension/`, run:
```bash
npm run watch
```
This automatically recompiles TypeScript whenever you save a file. Then, you only need to click the **Reload (🔄)** icon on `chrome://extensions` and refresh your browser tab!

---

## 7. Troubleshooting Common Issues

### Issue 1: "Manifest file is missing or unreadable"
- **Cause:** You selected the wrong folder when clicking "Load unpacked".
- **Fix:** Make sure you select the folder that directly contains the `manifest.json` file (the `extension/` directory).

### Issue 2: Extension UI not appearing on webpage
- **Cause:** Some special Chrome internal pages (e.g., `chrome://extensions`, `chrome://settings`, `about:blank`, or the Chrome Web Store) block extensions for security reasons.
- **Fix:** Open a regular website like `https://example.com` or `https://wikipedia.org` to test.

### Issue 3: Content script errors after reloading extension
- **Cause:** When you reload an extension on `chrome://extensions`, existing open web tabs still hold the old extension context.
- **Fix:** Simply **refresh the web tab (F5)** where you are testing HaCha after clicking the extension reload button.

### Issue 4: Local WASM OCR loading slowly on first run
- **Cause:** Tesseract.js downloads worker scripts and language data files (`eng.traineddata.gz`) on initial initialization.
- **Fix:** Allow a few seconds on first run. Subsequent OCR checks will use cached local WebAssembly assets and run fast.

---

*Now you're ready to test and build Chrome Extensions like a pro! If you have any questions or encounter issues, refer to [PROJECT_CONTEXT.md](file:///c:/Users/CSE%20LAB%201/Downloads/HaCha/PROJECT_CONTEXT.md).*
