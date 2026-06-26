# UPTET Question Bank Explorer

A lightweight, high-performance, modular dashboard application designed to browse, search, edit, curate, and synchronize UPTET study questions.

## 1. Directory Structure
```
UPTET_Explorer/
├── css/
│   └── styles.css              # Centralized glassmorphic stylesheet
├── js/
│   ├── config.js               # UPTET Dashboard configurations
│   ├── state.js                # State management and local storage bindings
│   ├── sync.js                 # GitHub Gist sync engine (30-day Last-Write-Wins)
│   ├── ui.js                   # DOM rendering, infinite scroll, and event handlers
│   └── main.js                 # App orchestrator & DOM initializations
├── index.html                  # Main Dashboard page
└── questions.json              # UPTET question bank (920 questions)
```

---

## 2. Key Features

* **Tailored UPTET Dashboard Layout:** Adapted from the premium UPPSC Explorer to fit UPTET data (CDP, English, Hindi, Maths, Science, Social Studies, EVS). Features inline LaTeX math support (via KaTeX CDN) and markdown notes.
* **Intelligent Cloud Sync:** Secure progress backups (completed, notes, answers, custom tags, and deleted items) saved to a private GitHub Gist under `uptet_progress.json`.
* **30-Day Last-Write-Wins (LWW) Merge Engine:** A conflict-resolution engine that automatically merges local and remote progress based on microsecond-accurate event timestamps, with 30-day garbage collection to prune stale metadata.
* **Personal Notes:** Add custom study notes to individual questions with markdown and KaTeX math support.
* **Metadata Curation (Tag Fix):** Override core branch (subject), paper level, and topic/concepts directly from the UI.
* **Correct Answer Mapping:** Save and highlight correct answers directly on options (A/B/C/D).
* **One-Click Clipboard Copying:** Copy formatted question cards directly to clipboard, pre-labeled with subjects and concepts.
* **Ask Google AI:** Instantly launch Google Search queries for active cards.

---

## 3. How to Run Locally

1. **Option A: Static File Execution**
   Double-click `index.html` to open it directly in your web browser. Due to local files module security (CORS), opening native ES6 modules from local files may require a local server in some browsers.
   
2. **Option B: Local Web Server (Recommended)**
   Run a quick HTTP server in this directory:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # NodeJS
   npx serve .
   ```
   Then navigate to `http://localhost:8000/index.html` in your browser.
