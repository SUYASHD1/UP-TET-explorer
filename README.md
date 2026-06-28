# UPTET & TET Question Bank Explorer

A lightweight, high-performance, modular dashboard application designed to browse, search, edit, curate, and synchronize a unified database of TET study questions from CTET, REET, and UPTET.

---

## 1. Directory Structure

```text
UP TET/
├── TET database/               # Raw scraped JSON datasets (CTET, REET, UPTET)
├── scratch/                    # Sanitization, processing & validation scripts
│   ├── sanitize_questions.py   # Automated parser & schema normalizer
│   └── validate_output.py      # Structural verification script
└── UPTET_Explorer/             # Main Web Dashboard Application
    ├── css/
    │   └── styles.css          # Centralized glassmorphic stylesheet
    ├── js/
    │   ├── config.js           # UPTET Dashboard configurations
    │   ├── state.js            # State management & local storage bindings
    │   ├── sync.js             # GitHub Gist sync engine (30-day Last-Write-Wins)
    │   ├── ui.js               # DOM rendering, infinite scroll, and event handlers
    │   └── main.js             # App orchestrator & DOM initializations
    ├── index.html              # Main Dashboard page
    └── questions.json          # Sanitized question database (3,150 questions)
```

---

## 2. Key Features

*   **Unified TET Question Database:** A clean database containing **3,150 questions** compiled from CTET, REET, and UPTET exams (from 2011 to 2024). All transactional noise, chatbot history, and UI debris have been completely pruned.
*   **Advanced Filtering Controls:**
    *   **Sidebar Sections:** CDP, English, Hindi, Mathematics, Science, Social Studies, EVS.
    *   **Exam/Organization Dropdown:** CTET, REET, UPTET.
    *   **Cognitive/Paper Level Tabs:** Paper 1, Paper 2.
    *   **Exam Year Dropdown:** 2011 to 2024.
    *   **Test Set Dropdown:** Filters dynamically by the specific scraped test set title.
*   **Intelligent Cloud Sync:** Secure progress backups (completed, notes, answers, custom tags, and deleted items) saved to a private GitHub Gist under `uptet_progress.json`.
*   **30-Day Last-Write-Wins (LWW) Merge Engine:** A conflict-resolution engine that automatically merges local and remote progress based on microsecond-accurate event timestamps, with 30-day garbage collection to prune stale metadata.
*   **Personal Notes:** Add custom study notes to individual questions with markdown and KaTeX math support.
*   **Metadata Curation (Tag Fix):** Override core branch (subject), paper level, and topic/concepts directly from the UI.
*   **Correct Answer Mapping:** Save and highlight correct answers directly on options (A/B/C/D).
*   **One-Click Clipboard Copying:** Copy formatted question cards directly to clipboard, pre-labeled with subjects and concepts.
*   **Ask Google AI:** Instantly launch Google Search queries for active cards.

---

## 3. Sanitization Pipeline

To regenerate or update the question database:
1.  Place raw question JSON files in `TET database/`.
2.  Run the sanitization script from the root directory:
    ```bash
    python scratch/sanitize_questions.py
    ```
    This script extracts the test level metadata, strips the option labels and inline choice listings, fixes unicode escape sequences, and merges them into `UPTET_Explorer/questions.json`.
3.  Validate the output structure:
    ```bash
    python scratch/validate_output.py
    ```

---

## 4. How to Run Locally

1.  **Option A: Static File Execution**
    Double-click `index.html` to open it directly in your web browser. Due to local files module security (CORS), opening native ES6 modules from local files may require a local server in some browsers.
    
2.  **Option B: Local Web Server (Recommended)**
    Run a quick HTTP server in the `UPTET_Explorer` directory:
    ```bash
    # Python 3
    python -m http.server 8000
    
    # NodeJS
    npx serve .
    ```
    Then navigate to `http://localhost:8000/index.html` in your browser.
