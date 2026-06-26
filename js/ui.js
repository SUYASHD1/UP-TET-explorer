/**
 * UI Rendering and Interaction Module
 */
import { debouncedSync, uploadToGist, connectGitHub, disconnectGitHub, resolveSync } from './sync.js';

let stateRef = null;
let currentEditingSig = null;

// Helper to safely render/refresh Lucide icons with a DOM settle delay
export function refreshIcons() {
    if (window.lucide) {
        setTimeout(() => {
            window.lucide.createIcons({ icons: window.lucide.icons });
        }, 10);
    }
}

// DOM Cache
let DOM = {};

export function initUI(state) {
    stateRef = state;

    // Cache elements
    DOM.container = document.getElementById('questions-container');
    DOM.searchInput = document.getElementById('search-bar');
    DOM.examFilter = document.getElementById('exam-filter');
    DOM.yearFilter = document.getElementById('year-filter');
    DOM.sourceFilter = document.getElementById('source-filter');
    DOM.loader = document.getElementById('loader');
    DOM.emptyState = document.getElementById('empty-state');
    DOM.loadedCount = document.getElementById('loaded-count');
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.themeIcon = document.getElementById('theme-icon');

    DOM.syncModal = document.getElementById('sync-modal');
    DOM.syncSettingsBtn = document.getElementById('sync-settings-btn');
    DOM.closeModalBtn = document.getElementById('close-modal-btn');
    DOM.githubTokenInput = document.getElementById('github-token');
    DOM.syncInfoDiv = document.getElementById('sync-info');
    DOM.gistIdDisplay = document.getElementById('gist-id-display');
    DOM.connectBtn = document.getElementById('connect-btn');
    DOM.disconnectBtn = document.getElementById('disconnect-btn');

    DOM.addSectionModal = document.getElementById('add-section-modal');
    DOM.newSectionNameInput = document.getElementById('new-section-name');
    DOM.sectionList = document.getElementById('section-list');
    DOM.linkToggleBtn = document.getElementById('link-toggle-btn');
    DOM.linkToggleIcon = document.getElementById('link-toggle-icon');

    // Note Modal DOM Elements
    DOM.noteEditorModal = document.getElementById('note-editor-modal');
    DOM.noteModalTitle = document.getElementById('note-modal-title');
    DOM.noteModalQBadge = document.getElementById('note-modal-q-badge');
    DOM.noteModalQText = document.getElementById('note-modal-q-text');
    DOM.noteModalTextarea = document.getElementById('note-modal-textarea');

    // Register event listeners
    if (DOM.searchInput) DOM.searchInput.addEventListener('input', applyFilters);
    if (DOM.examFilter) DOM.examFilter.addEventListener('change', applyFilters);
    if (DOM.yearFilter) DOM.yearFilter.addEventListener('change', applyFilters);
    if (DOM.sourceFilter) DOM.sourceFilter.addEventListener('change', applyFilters);

    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const targetTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', targetTheme);
            if (DOM.themeIcon) {
                DOM.themeIcon.setAttribute('data-lucide', targetTheme === 'light' ? 'sun' : 'moon');
            }
            refreshIcons();
        });
    }

    if (DOM.syncSettingsBtn) {
        DOM.syncSettingsBtn.addEventListener('click', () => {
            loadSyncModalState();
            DOM.syncModal.classList.add('active');
        });
    }

    if (DOM.closeModalBtn) {
        DOM.closeModalBtn.addEventListener('click', () => {
            DOM.syncModal.classList.remove('active');
        });
    }

    DOM.resetConfirmModal = document.getElementById('reset-confirm-modal');
    DOM.resetConfirmInput = document.getElementById('reset-confirm-input');
    DOM.confirmResetBtn = document.getElementById('confirm-reset-btn');
    DOM.resetCompletedCount = document.getElementById('reset-completed-count');
    DOM.resetNotesCount = document.getElementById('reset-notes-count');
    DOM.resetAnswersCount = document.getElementById('reset-answers-count');
    DOM.resetSectionsCount = document.getElementById('reset-sections-count');

    DOM.deleteSectionModal = document.getElementById('delete-section-modal');
    DOM.deleteSectionName = document.getElementById('delete-section-name');

    DOM.renameSectionModal = document.getElementById('rename-section-modal');
    DOM.renameSectionInput = document.getElementById('rename-section-input');

    if (DOM.resetConfirmInput) {
        DOM.resetConfirmInput.addEventListener('input', (e) => {
            if (DOM.confirmResetBtn) {
                DOM.confirmResetBtn.disabled = (e.target.value !== 'RESET');
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === DOM.syncModal) {
            DOM.syncModal.classList.remove('active');
        }
        if (DOM.addSectionModal && e.target === DOM.addSectionModal) {
            closeAddSectionModal();
        }
        if (DOM.resetConfirmModal && e.target === DOM.resetConfirmModal) {
            closeResetModal();
        }
        if (DOM.deleteSectionModal && e.target === DOM.deleteSectionModal) {
            closeDeleteSectionModal();
        }
        if (DOM.renameSectionModal && e.target === DOM.renameSectionModal) {
            closeRenameSectionModal();
        }
        if (DOM.noteEditorModal && e.target === DOM.noteEditorModal) {
            closeNoteEditorModal();
        }
        if (!e.target.closest('.dropdown-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
        }
    });

    // Infinite scroll trigger
    const trigger = document.getElementById('load-more-trigger');
    if (trigger) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                renderNextBatch();
            }
        }, { threshold: 0.1 });
        observer.observe(trigger);
    }

    // Bind all handlers to window to preserve inline HTML onclick/onblur
    bindGlobals();
}

function bindGlobals() {
    window.filterByBranch = filterByBranch;
    window.filterByBloom = filterByBloom;
    window.setStatusFilter = setStatusFilter;
    window.clearAllProgress = clearAllProgress;
    
    // Notes
    window.toggleNoteEditor = toggleNoteEditor;
    window.saveNote = saveNote;
    window.clearNote = clearNote;
    window.editNote = editNote;
    window.cancelNoteEdit = cancelNoteEdit;
    window.closeNoteEditorModal = closeNoteEditorModal;
    window.executeSaveNoteModal = executeSaveNoteModal;

    // Tags
    window.toggleTagEditor = toggleTagEditor;
    window.cancelTagEdit = cancelTagEdit;
    window.saveTagEdit = saveTagEdit;

    // Answers
    window.toggleAnswerEditor = toggleAnswerEditor;
    window.saveCorrectAnswer = saveCorrectAnswer;
    window.clearCorrectAnswer = clearCorrectAnswer;

    // Deletes
    window.toggleDeleteConfirm = toggleDeleteConfirm;
    window.cancelDelete = cancelDelete;
    window.confirmDelete = confirmDelete;

    // Actions
    window.openGoogleAI = openGoogleAI;
    window.copyQuestion = copyQuestion;
    window.toggleCompleted = toggleCompleted;

    // Cloud Settings
    window.connectGitHub = connectGitHubBtn;
    window.disconnectGitHub = disconnectGitHubBtn;
    window.resolveSync = resolveSyncBtn;

    // Custom Sections
    window.toggleSectionLinkMode = toggleSectionLinkMode;
    window.openAddSectionModal = openAddSectionModal;
    window.closeAddSectionModal = closeAddSectionModal;
    window.createCustomSection = createCustomSection;
    window.selectSection = selectSection;
    window.toggleCustomSectionTag = toggleCustomSectionTag;
    window.toggleDropdown = toggleDropdown;
    window.openDeleteSectionModal = openDeleteSectionModal;
    window.closeDeleteSectionModal = closeDeleteSectionModal;
    window.executeDeleteSection = executeDeleteSection;
    window.openRenameSectionModal = openRenameSectionModal;
    window.closeRenameSectionModal = closeRenameSectionModal;
    window.executeRenameSection = executeRenameSection;

    // Reset Progress Guardrails
    window.closeResetModal = closeResetModal;
    window.downloadBackup = downloadBackup;
    window.executeProgressReset = executeProgressReset;
    window.clearAllProgress = clearAllProgress;
}

// Stats & badging
export function updateStats() {
    if (!stateRef) return;
    const nonDeletedTotal = stateRef.questions.filter(q => !stateRef.deletedSet.has(stateRef.config.getSignature(q))).length;
    if (DOM.loadedCount) {
        DOM.loadedCount.textContent = `Showing ${stateRef.displayedCount} of ${stateRef.filteredQuestions.length} Questions (Total: ${nonDeletedTotal})`;
    }

    let activeCount = 0;
    let completedCount = 0;
    let notesCount = 0;

    stateRef.questions.forEach(q => {
        const sig = stateRef.config.getSignature(q);
        if (stateRef.deletedSet.has(sig)) return;

        const hasNote = stateRef.notes[sig] && stateRef.notes[sig].trim();
        if (hasNote) notesCount++;

        if (stateRef.completedSet.has(sig)) {
            completedCount++;
        } else {
            activeCount++;
        }
    });

    const activeBadge = document.getElementById('active-badge-count');
    const completedBadge = document.getElementById('completed-badge-count');
    const notesBadge = document.getElementById('notes-badge-count');

    if (activeBadge) activeBadge.textContent = activeCount;
    if (completedBadge) completedBadge.textContent = completedCount;
    if (notesBadge) notesBadge.textContent = notesCount;

    const progressCounts = document.getElementById('progress-counts');
    const progressPercent = document.getElementById('progress-percentage');

    if (progressCounts) progressCounts.textContent = `Completed: ${completedCount} / ${nonDeletedTotal}`;

    const percent = nonDeletedTotal > 0 ? Math.round((completedCount / nonDeletedTotal) * 100) : 0;
    if (progressPercent) progressPercent.textContent = `${percent}%`;

    // Render sections widget in sidebar
    renderSectionsWidget();
}

function getParsedNote(noteText) {
    if (!noteText) return '';

    // Normalize newlines first
    let normalized = noteText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 1. Auto-wrap math formulas that lack delimiters, line-by-line
    const hasExplicitDelimiters = normalized.includes('$') || normalized.includes('\\(') || normalized.includes('\\[') || normalized.includes('\\{');
    if (!hasExplicitDelimiters) {
        const lines = normalized.split('\n');
        // Exclude newlines from mathSafeChars by using spaces and tabs directly instead of \s
        const mathSafeChars = "[a-zA-Z0-9\\+\\-\\*\\/=\\(\\)\\[\\]\\{\\} \\t\\\\_,\\^<>:;\\.%'\\?]";
        const segmentRegex = new RegExp(`${mathSafeChars}{3,}`, 'g');
        
        const processedLines = lines.map(line => {
            return line.replace(segmentRegex, (match) => {
                const trimmed = match.trim();
                if (trimmed.length < 3) return match;
                
                const hasLaTeX = /\\(?:[a-zA-Z]+)/.test(trimmed);
                const hasSubSuper = /[\w_]_[a-zA-Z0-9]+|[\w_]\^[a-zA-Z0-9]+/.test(trimmed);
                
                if (!hasLaTeX && !hasSubSuper) {
                    return match;
                }
                
                const stopwords = /\b(the|and|are|for|was|but|not|you|with|this|that|from|have|what|how|why|who|which|where|when|then|here|there|some|many|more|most|also|just|only|into|over|than|will|would|should|could|can|about|after|before|been|has|had|does|done|did|make|made|get|got|take|took|come|came|give|gave|find|found|think|thought|know|knew|tell|told|say|said|see|saw|formula|equation|question|answer|note|study|concept|branch|topic|level|trace|correct|wrong|right|false|true|value|result|show|find|solve|derive|calculate|compute)\b/i;
                if (stopwords.test(trimmed)) {
                    return match;
                }
                
                const isSubscriptVar = /^[a-zA-Z]_[a-zA-Z0-9]+$/.test(trimmed);
                const hasMathOperators = /[\+\-\*\/=\(\)\[\]\{\}<>,\^]/.test(trimmed) || hasLaTeX || isSubscriptVar;
                if (!hasMathOperators) {
                    return match;
                }
                
                const leadingSpace = match.slice(0, match.indexOf(trimmed));
                const trailingSpace = match.slice(match.indexOf(trimmed) + trimmed.length);
                return `${leadingSpace}$${trimmed}$${trailingSpace}`;
            });
        });
        
        normalized = processedLines.join('\n');
    }

    // 2. Extract and protect math blocks from markdown processing
    const mathBlocks = [];
    
    // Protect display math $$...$$
    normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        mathBlocks.push({ type: 'display', content: math });
        return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });
    
    // Protect inline math $...$
    normalized = normalized.replace(/\$([^\$\s][^\$]*?[^\$\s]|\S)\$/g, (match, math) => {
        mathBlocks.push({ type: 'inline', content: math });
        return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });
    
    // Protect \(...\)
    normalized = normalized.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
        mathBlocks.push({ type: 'inline_paren', content: math });
        return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });
    
    // Protect \[...\]
    normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
        mathBlocks.push({ type: 'display_bracket', content: math });
        return `%%MATH_BLOCK_${mathBlocks.length - 1}%%`;
    });

    let htmlResult = '';
    try {
        if (window.marked && typeof window.marked.parse === 'function') {
            htmlResult = window.marked.parse(normalized);
        } else {
            htmlResult = normalized
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");
        }
    } catch (e) {
        console.warn("Marked.js failed to parse note: ", e);
        htmlResult = normalized
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    // 3. Restore the protected math blocks
    mathBlocks.forEach((block, index) => {
        const placeholder = `%%MATH_BLOCK_${index}%%`;
        let replacement = '';
        if (block.type === 'display') {
            replacement = `$$${block.content}$$`;
        } else if (block.type === 'inline') {
            replacement = `$${block.content}$`;
        } else if (block.type === 'inline_paren') {
            replacement = `\\(${block.content}\\)`;
        } else if (block.type === 'display_bracket') {
            replacement = `\\[${block.content}\\]`;
        }
        htmlResult = htmlResult.split(placeholder).join(replacement);
    });

    return htmlResult;
}

// Math Equations KaTeX helper
function triggerMathRender(elem) {
    if (window.renderMathInElement) {
        window.renderMathInElement(elem, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
}

// Render cards
export function renderNextBatch() {
    if (!stateRef || stateRef.displayedCount >= stateRef.filteredQuestions.length) return;

    const nextBatch = stateRef.filteredQuestions.slice(stateRef.displayedCount, stateRef.displayedCount + stateRef.batchSize);
    nextBatch.forEach((q, index) => {
        const relativeIndex = stateRef.displayedCount + index + 1;
        const sig = stateRef.config.getSignature(q);
        const isCompleted = stateRef.completedSet.has(sig);

        // Get Tag Overrides
        const overrides = stateRef.tagOverrides[sig] || {};
        const branch = overrides.core_branch || q.metadata?.core_branch || 'General';
        const topic = overrides.topic || q.metadata?.topic || (stateRef.config.copyPrefix === 'Physics' ? 'Concept' : 'General Studies');
        const bloom = overrides.bloom_level || q.metadata?.bloom_level || 'Understanding';
        const hasNote = stateRef.notes[sig] && stateRef.notes[sig].trim();
        const noteVal = stateRef.notes[sig] || '';
        const ansVal = stateRef.correctAnswers[sig] || '';

        const isTrace = stateRef.config.isTraceOnly(q);

        // Custom section tags as badges
        const tags = stateRef.customTags[sig] || [];
        const tagBadgesHtml = tags.map(tagId => {
            const section = stateRef.customSections.find(s => s.id === tagId);
            if (!section) return '';
            return `<span class="section-badge" style="background: rgba(168, 85, 247, 0.15); color: var(--accent-color); border: 1px solid rgba(168, 85, 247, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;"><i data-lucide="folder" style="width: 12px; height: 12px;"></i> ${section.name}</span>`;
        }).join('');

        // Custom dropdown items for Organize
        let dropdownHtml = '';
        if ((stateRef.customSections || []).length > 0) {
            dropdownHtml = stateRef.customSections.map(section => {
                const hasTag = tags.includes(section.id);
                return `
                    <div class="dropdown-item" onclick="toggleCustomSectionTag('${sig}', '${section.id}')" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: var(--text-secondary); transition: var(--transition-smooth);">
                        <i data-lucide="check" style="width: 14px; height: 14px; color: var(--success-color); opacity: ${hasTag ? 1 : 0};"></i>
                        <span>${section.name}</span>
                    </div>
                `;
            }).join('');
        } else {
            dropdownHtml = `<div style="font-size: 0.75rem; color: var(--text-secondary); padding: 0.5rem; text-align: center;">No custom sections. Click [+] in sidebar to create.</div>`;
        }

        const card = document.createElement('div');
        card.className = `q-card ${isCompleted ? 'completed' : ''}`;
        card.innerHTML = `
            <div class="card-header">
                <div class="badge-row">
                    <span class="q-number-badge">Q${relativeIndex}</span>
                    <span class="branch-badge">${branch}</span>
                    <span class="bloom-badge">${bloom}</span>
                    ${isTrace ? `<span class="trace-badge"><i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Trace Only</span>` : ''}
                    ${hasNote ? `<span class="note-indicator-badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;"><i data-lucide="sticky-note" style="width: 12px; height: 12px;"></i> Has Note</span>` : ''}
                    ${ansVal ? `<span class="answer-indicator-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success-color); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;"><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Ans: ${ansVal}</span>` : ''}
                    ${tagBadgesHtml}
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span class="q-meta">${stateRef.config.renderHeaderBadge(q)}</span>
                    <button class="copy-btn" onclick="copyQuestion(this, '${sig}')" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; transition: var(--transition-smooth);">
                        <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy
                    </button>
                </div>
            </div>
            <div class="topic-label">
                <i data-lucide="compass" style="width: 14px; height: 14px;"></i> Concept: ${topic}
            </div>
            <div class="q-text">${stateRef.config.getQuestionText(q)}</div>
            <div class="options-grid">
                <div class="option-item ${ansVal === 'A' ? 'correct-answer' : ''}"><span class="option-label">A</span> ${stateRef.config.getOptions(q).A}</div>
                <div class="option-item ${ansVal === 'B' ? 'correct-answer' : ''}"><span class="option-label">B</span> ${stateRef.config.getOptions(q).B}</div>
                <div class="option-item ${ansVal === 'C' ? 'correct-answer' : ''}"><span class="option-label">C</span> ${stateRef.config.getOptions(q).C}</div>
                <div class="option-item ${ansVal === 'D' ? 'correct-answer' : ''}"><span class="option-label">D</span> ${stateRef.config.getOptions(q).D}</div>
            </div>
            
            <div class="note-container" id="note-container-${sig}" style="margin-top: 0.75rem; display: ${hasNote ? 'block' : 'none'}; background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; border-bottom: 1px dashed rgba(245, 158, 11, 0.2); padding-bottom: 0.35rem;">
                    <span style="font-size: 0.8rem; font-weight: 600; color: #f59e0b; display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="sticky-note" style="width: 14px; height: 14px;"></i> Personal Notes
                    </span>
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <button id="note-edit-btn-${sig}" onclick="editNote('${sig}')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem;">
                            <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Edit
                        </button>
                        <button onclick="clearNote('${sig}')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem;">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Clear
                        </button>
                    </div>
                </div>
                <!-- Rendered Markdown + KaTeX Notes -->
                <div id="note-display-${sig}" class="note-display-content" style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; display: ${hasNote ? 'block' : 'none'};"></div>
            </div>

            <div class="tag-editor-container" id="tag-editor-${sig}" style="display: none; margin-top: 0.75rem; background: rgba(var(--accent-rgb), 0.05); border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: 10px; padding: 0.75rem; flex-direction: column; gap: 0.75rem;">
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--accent-color); display: flex; align-items: center; gap: 0.35rem;">
                    <i data-lucide="settings" style="width: 14px; height: 14px;"></i> Edit Question Metadata
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="input-group" style="gap: 0.25rem; display: flex; flex-direction: column;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Core Branch</label>
                        <select id="edit-branch-${sig}" style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 0.4rem; font-family: var(--font-body); font-size: 0.85rem; outline: none;"></select>
                    </div>
                    <div class="input-group" style="gap: 0.25rem; display: flex; flex-direction: column;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Bloom Level</label>
                        <select id="edit-bloom-${sig}" style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 0.4rem; font-family: var(--font-body); font-size: 0.85rem; outline: none;"></select>
                    </div>
                </div>
                <div class="input-group" style="gap: 0.25rem; display: flex; flex-direction: column;">
                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Concept / Topic</label>
                    <input type="text" id="edit-topic-${sig}" style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 0.4rem; font-family: var(--font-body); font-size: 0.85rem; outline: none; width: 100%;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem;">
                    <button onclick="cancelTagEdit('${sig}')" class="btn-secondary" style="padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary);">Cancel</button>
                    <button onclick="saveTagEdit('${sig}')" class="btn-primary" style="padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: var(--accent-color); border: none; color: white;">Save Changes</button>
                </div>
            </div>

            <div class="answer-editor-container" id="answer-editor-${sig}" style="display: none; margin-top: 0.75rem; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; padding: 0.75rem;">
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--success-color); display: flex; align-items: center; gap: 0.35rem; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="key" style="width: 14px; height: 14px;"></i> Select Correct Answer
                    </span>
                    <button onclick="clearCorrectAnswer('${sig}')" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem; ${ansVal ? '' : 'display: none;'}">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> Clear Answer
                    </button>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <button onclick="saveCorrectAnswer('${sig}', '${opt}')" style="flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; border: 1px solid ${ansVal === opt ? 'var(--success-color)' : 'var(--border-color)'}; background: ${ansVal === opt ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)'}; color: ${ansVal === opt ? 'var(--success-color)' : 'var(--text-primary)'}; transition: var(--transition-smooth);">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="delete-confirm-container" id="delete-confirm-${sig}" style="display: none; margin-top: 0.75rem; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <span style="font-size: 0.85rem; font-weight: 600; color: #ef4444; display: flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i> Permanently remove from workflow?
                    </span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="cancelDelete('${sig}')" class="btn-secondary" style="padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary);">Cancel</button>
                        <button onclick="confirmDelete('${sig}')" class="btn-primary" style="padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: #ef4444; border: none; color: white;">Delete</button>
                    </div>
                </div>
            </div>

            <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-top: auto;">
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <button onclick="openGoogleAI('${sig}')" class="ai-btn" style="margin: 0; padding: 0.5rem 0.75rem;">
                        <i data-lucide="bot" style="width: 16px; height: 16px;"></i> Ask AI
                    </button>
                    <button class="note-btn ${hasNote ? 'active' : ''}" onclick="toggleNoteEditor('${sig}')" style="background: transparent; border: 1px solid ${hasNote ? '#f59e0b' : 'var(--border-color)'}; color: ${hasNote ? '#f59e0b' : 'var(--text-secondary)'}; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: var(--transition-smooth);">
                        <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i> Notes
                    </button>
                    <button class="edit-tags-btn" onclick="toggleTagEditor('${sig}')" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: var(--transition-smooth);">
                        <i data-lucide="tag" style="width: 16px; height: 16px;"></i> Tag Fix
                    </button>
                    <button class="answer-btn ${ansVal ? 'active' : ''}" onclick="toggleAnswerEditor('${sig}')" style="background: transparent; border: 1px solid ${ansVal ? 'var(--success-color)' : 'var(--border-color)'}; color: ${ansVal ? 'var(--success-color)' : 'var(--text-secondary)'}; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: var(--transition-smooth);">
                        <i data-lucide="key" style="width: 16px; height: 16px;"></i> Answer
                    </button>
                    
                    <!-- Organize Dropdown -->
                    <div class="dropdown-container">
                        <button class="dropdown-btn" onclick="toggleDropdown('${sig}')">
                            <i data-lucide="folder-symlink" style="width: 16px; height: 16px;"></i>
                            <span>Organize</span>
                            <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
                        </button>
                        <div class="dropdown-menu" id="dropdown-menu-${sig}">
                            <div class="dropdown-section-title">Move to Custom List</div>
                            <div class="custom-sections-menu-list" id="custom-sections-menu-${sig}">
                                ${dropdownHtml}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1.5rem; align-items: center;">
                    <button class="delete-btn" onclick="toggleDeleteConfirm('${sig}')" style="background: transparent; border: 1px solid var(--border-color); color: #ef4444; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: var(--transition-smooth);">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i> Delete
                    </button>
                    <button class="action-btn-pill completed-toggle ${isCompleted ? 'active' : ''}" onclick="toggleCompleted('${sig}')" style="background: ${isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}; border: 1px solid ${isCompleted ? 'var(--success-color)' : 'var(--border-color)'}; color: ${isCompleted ? 'var(--success-color)' : 'var(--text-secondary)'}; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem; transition: var(--transition-smooth);">
                        <i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i> ${isCompleted ? 'Done' : 'Mark Done'}
                    </button>
                </div>
            </div>
        `;
        DOM.container.appendChild(card);
        if (hasNote) {
            const displayDiv = card.querySelector(`[id="note-display-${sig}"]`);
            if (displayDiv) {
                displayDiv.innerHTML = getParsedNote(noteVal);
            }
        }
        try {
            triggerMathRender(card);
        } catch (err) {
            console.warn("KaTeX rendering failed for a card, skipping math render to protect UI.", err);
        }
    });

    stateRef.displayedCount += nextBatch.length;
    updateStats();
    refreshIcons();
}

// Apply filters & search
export function applyFilters() {
    if (!stateRef) return;
    const searchTerm = DOM.searchInput ? DOM.searchInput.value.toLowerCase().trim() : '';
    const selectedSource = DOM.sourceFilter ? DOM.sourceFilter.value : 'all';
    const selectedExam = DOM.examFilter ? DOM.examFilter.value : 'all';
    const selectedYear = DOM.yearFilter ? DOM.yearFilter.value : 'all';

    stateRef.filteredQuestions = stateRef.questions.filter(q => {
        const sig = stateRef.config.getSignature(q);
        if (stateRef.deletedSet.has(sig)) return false; // Exclude deleted questions

        const isCompleted = stateRef.completedSet.has(sig);

        // Get Tag Overrides
        const overrides = stateRef.tagOverrides[sig] || {};
        const qBranch = overrides.core_branch || q.metadata?.core_branch || 'General';
        const qTopic = overrides.topic || q.metadata?.topic || (stateRef.config.copyPrefix === 'Physics' ? 'Concept' : 'General Studies');
        const qBloom = overrides.bloom_level || q.metadata?.bloom_level || 'Understanding';
        const hasNote = stateRef.notes[sig] && stateRef.notes[sig].trim();
        const noteVal = stateRef.notes[sig] || '';

        // 1. Status & Section Filter
        const isCustomSection = !['all', 'active', 'completed', 'notes'].includes(stateRef.sectionFilter);
        const questionTags = stateRef.customTags[sig] || [];
        const hasAnyCustomTags = questionTags.length > 0;

        if (stateRef.sectionLinkMode === 'unlinked') {
            if (isCustomSection) {
                if (!questionTags.includes(stateRef.sectionFilter)) return false;
            } else {
                if (hasAnyCustomTags) return false;

                let statusFilterToUse = stateRef.currentStatusFilter;
                if (stateRef.sectionFilter !== 'all') {
                    statusFilterToUse = stateRef.sectionFilter;
                }

                if (statusFilterToUse === 'active') {
                    if (isCompleted) return false;
                } else if (statusFilterToUse === 'completed') {
                    if (!isCompleted) return false;
                } else if (statusFilterToUse === 'notes') {
                    if (!hasNote) return false;
                }
            }
        } else {
            if (isCustomSection) {
                if (!questionTags.includes(stateRef.sectionFilter)) return false;

                const statusFilterToUse = stateRef.currentStatusFilter;
                if (statusFilterToUse === 'active') {
                    if (isCompleted) return false;
                } else if (statusFilterToUse === 'completed') {
                    if (!isCompleted) return false;
                } else if (statusFilterToUse === 'notes') {
                    if (!hasNote) return false;
                }
            } else {
                let statusFilterToUse = stateRef.currentStatusFilter;
                if (stateRef.sectionFilter !== 'all') {
                    statusFilterToUse = stateRef.sectionFilter;
                }

                if (statusFilterToUse === 'active') {
                    if (isCompleted) return false;
                } else if (statusFilterToUse === 'completed') {
                    if (!isCompleted) return false;
                } else if (statusFilterToUse === 'notes') {
                    if (!hasNote) return false;
                }
            }
        }

        // 2. Branch Sidebar Filter (ignored if unlinked and filtering by section)
        const skipBranchFilter = (stateRef.sectionLinkMode === 'unlinked' && stateRef.sectionFilter !== 'all');
        if (!skipBranchFilter && stateRef.selectedBranch !== 'all' && qBranch !== stateRef.selectedBranch) return false;

        // 3. Bloom Level Tab Filter
        if (stateRef.selectedBloom !== 'all' && qBloom !== stateRef.selectedBloom) return false;

        // 4. Dropdown Filters
        if (stateRef.config.hasSourceFilter) {
            if (selectedSource !== 'all' && q.source_file !== selectedSource) return false;
        }
        if (stateRef.config.hasExamFilter) {
            if (selectedExam !== 'all' && q.exam !== selectedExam) return false;
        }
        if (stateRef.config.hasYearFilter) {
            if (selectedYear !== 'all' && q.year?.toString() !== selectedYear) return false;
        }

        // 5. Search Filter
        const qText = stateRef.config.getQuestionText(q);
        const qOpts = stateRef.config.getOptions(q);
        const matchesSearch = qText.toLowerCase().includes(searchTerm) || 
                              qOpts.A.toLowerCase().includes(searchTerm) ||
                              qOpts.B.toLowerCase().includes(searchTerm) ||
                              qOpts.C.toLowerCase().includes(searchTerm) ||
                              qOpts.D.toLowerCase().includes(searchTerm) ||
                              qTopic.toLowerCase().includes(searchTerm) ||
                              noteVal.toLowerCase().includes(searchTerm);
        
        return matchesSearch;
    });

    if (DOM.container) DOM.container.innerHTML = '';
    stateRef.displayedCount = 0;
    
    if (stateRef.filteredQuestions.length === 0) {
        if (DOM.emptyState) DOM.emptyState.style.display = 'flex';
    } else {
        if (DOM.emptyState) DOM.emptyState.style.display = 'none';
        renderNextBatch();
    }
}

// Populate dynamic lists & dropdowns
export function analyzeDataset() {
    if (!stateRef) return;
    stateRef.branches = {};
    stateRef.bloomLevels.clear();
    stateRef.exams.clear();
    stateRef.years.clear();
    stateRef.sources.clear();

    stateRef.questions.forEach(q => {
        const sig = stateRef.config.getSignature(q);
        if (stateRef.deletedSet.has(sig)) return; // Exclude deleted questions
        
        const overrides = stateRef.tagOverrides[sig] || {};
        const b = overrides.core_branch || q.metadata?.core_branch || 'General';
        const bl = overrides.bloom_level || q.metadata?.bloom_level || 'Understanding';
        
        stateRef.branches[b] = (stateRef.branches[b] || 0) + 1;
        stateRef.bloomLevels.add(bl);
        if (q.exam) stateRef.exams.add(q.exam);
        if (q.year) stateRef.years.add(q.year);
        if (q.source_file) stateRef.sources.add(q.source_file);
    });

    // 1. Branches Sidebar
    const branchList = document.getElementById('branches-list');
    if (branchList) {
        const nonDeletedTotal = stateRef.questions.filter(q => !stateRef.deletedSet.has(stateRef.config.getSignature(q))).length;
        branchList.innerHTML = `
            <li class="category-item ${stateRef.selectedBranch === 'all' ? 'active' : ''}" id="branch-all" onclick="filterByBranch('all')">
                <span>All ${stateRef.config.copyPrefix === 'Physics' ? 'Branches' : 'Subjects'}</span>
                <span class="category-count" id="branch-count-all">${nonDeletedTotal}</span>
            </li>
        `;

        Object.keys(stateRef.branches).sort().forEach(bName => {
            const idName = `branch-${bName.replace(/[^a-zA-Z0-9]/g, '')}`;
            const item = document.createElement('li');
            item.className = `category-item ${stateRef.selectedBranch === bName ? 'active' : ''}`;
            item.id = idName;
            item.onclick = () => filterByBranch(bName);
            item.innerHTML = `
                <span>${bName}</span>
                <span class="category-count">${stateRef.branches[bName]}</span>
            `;
            branchList.appendChild(item);
        });
    }

    // 2. Bloom Tabs
    const bloomTabContainer = document.getElementById('bloom-tabs-container');
    if (bloomTabContainer) {
        bloomTabContainer.innerHTML = `
            <button class="bloom-tab ${stateRef.selectedBloom === 'all' ? 'active' : ''}" onclick="filterByBloom('all')" id="bloom-tab-all">All Cognitive Levels</button>
        `;
        Array.from(stateRef.bloomLevels).sort().forEach(bl => {
            const tab = document.createElement('button');
            tab.className = `bloom-tab ${stateRef.selectedBloom === bl ? 'active' : ''}`;
            tab.id = `bloom-tab-${bl.replace(/[^a-zA-Z0-9]/g, '')}`;
            tab.onclick = () => filterByBloom(bl);
            tab.textContent = bl;
            bloomTabContainer.appendChild(tab);
        });
    }

    // 3. Dropdowns
    if (stateRef.config.hasExamFilter && DOM.examFilter && DOM.examFilter.options.length <= 1) {
        Array.from(stateRef.exams).sort().forEach(exam => {
            const opt = document.createElement('option');
            opt.value = exam;
            opt.textContent = exam;
            DOM.examFilter.appendChild(opt);
        });
    }

    if (stateRef.config.hasYearFilter && DOM.yearFilter && DOM.yearFilter.options.length <= 1) {
        Array.from(stateRef.years).sort().forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            DOM.yearFilter.appendChild(opt);
        });
    }

    if (stateRef.config.hasSourceFilter && DOM.sourceFilter && DOM.sourceFilter.options.length <= 1) {
        Array.from(stateRef.sources).sort().forEach(src => {
            const opt = document.createElement('option');
            opt.value = src;
            opt.textContent = src.replace('.txt', '');
            DOM.sourceFilter.appendChild(opt);
        });
    }
}

// Branch sidebar click handler
export function filterByBranch(branch) {
    if (!stateRef) return;
    stateRef.selectedBranch = branch;
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.toggle('active', item.id === `branch-${branch.replace(/[^a-zA-Z0-9]/g, '')}`);
    });
    applyFilters();
}

// Bloom level tab click handler
export function filterByBloom(bloom) {
    if (!stateRef) return;
    stateRef.selectedBloom = bloom;
    document.querySelectorAll('.bloom-tab').forEach(tab => {
        tab.classList.toggle('active', tab.id === `bloom-tab-${bloom.replace(/[^a-zA-Z0-9]/g, '')}`);
    });
    applyFilters();
}

// Status filters
export function setStatusFilter(filter) {
    if (!stateRef) return;
    stateRef.currentStatusFilter = filter;
    
    // If in unlinked mode and a custom section was selected, reset it to all
    if (stateRef.sectionLinkMode === 'unlinked') {
        const isCustom = !['all', 'active', 'completed', 'notes'].includes(stateRef.sectionFilter);
        if (isCustom) {
            stateRef.sectionFilter = 'all';
        }
    }

    const activeBtn = document.getElementById('status-btn-active');
    const completedBtn = document.getElementById('status-btn-completed');
    const notesBtn = document.getElementById('status-btn-notes');

    if (activeBtn) activeBtn.classList.toggle('active', filter === 'active');
    if (completedBtn) completedBtn.classList.toggle('active', filter === 'completed');
    if (notesBtn) notesBtn.classList.toggle('active', filter === 'notes');

    applyFilters();
    renderSectionsWidget();
}

// Sync Modal states
export function loadSyncModalState() {
    if (!stateRef) return;
    const token = localStorage.getItem('uptet_github_token');
    const gistId = localStorage.getItem('uptet_gist_id');
    const conflictUi = document.getElementById('sync-conflict-ui');
    if (conflictUi) conflictUi.style.display = 'none';
    
    const modalActions = document.getElementById('sync-modal-actions');
    if (modalActions) modalActions.style.display = 'flex';

    if (token && gistId) {
        if (DOM.githubTokenInput) DOM.githubTokenInput.value = token;
        if (DOM.gistIdDisplay) DOM.gistIdDisplay.textContent = gistId;
        if (DOM.syncInfoDiv) DOM.syncInfoDiv.style.display = 'block';
        if (DOM.disconnectBtn) DOM.disconnectBtn.style.display = 'block';
        if (DOM.connectBtn) DOM.connectBtn.textContent = 'Sync Now';
    } else {
        if (DOM.githubTokenInput) DOM.githubTokenInput.value = '';
        if (DOM.syncInfoDiv) DOM.syncInfoDiv.style.display = 'none';
        if (DOM.disconnectBtn) DOM.disconnectBtn.style.display = 'none';
        if (DOM.connectBtn) DOM.connectBtn.textContent = 'Connect & Sync';
    }
}

// Conflict Resolution callbacks
function onConflict() {
    const conflictUi = document.getElementById('sync-conflict-ui');
    const modalActions = document.getElementById('sync-modal-actions');
    if (conflictUi) conflictUi.style.display = 'block';
    if (modalActions) modalActions.style.display = 'none';
    refreshIcons();
}

function onSyncSuccess() {
    updateStats();
    applyFilters();
    loadSyncModalState();
    alert(`Successfully connected and synced to GitHub Cloud!`);
}

function onSyncError(err) {
    alert("Connection Error: " + err.message);
}

// GitHub Button Handlers
async function connectGitHubBtn() {
    if (!stateRef) return;
    const token = DOM.githubTokenInput.value.trim();
    if (!token) {
        alert("Please enter a valid GitHub token.");
        return;
    }

    if (DOM.connectBtn) {
        DOM.connectBtn.disabled = true;
        DOM.connectBtn.textContent = 'Connecting...';
    }

    await connectGitHub(stateRef, token, DOM, onConflict, onSyncSuccess, onSyncError);

    if (DOM.connectBtn) {
        DOM.connectBtn.disabled = false;
    }
}

function disconnectGitHubBtn() {
    if (!stateRef) return;
    disconnectGitHub(stateRef, () => {
        loadSyncModalState();
        alert("Disconnected from GitHub Cloud Sync.");
    });
}

async function resolveSyncBtn(action) {
    if (!stateRef) return;
    const conflictUi = document.getElementById('sync-conflict-ui');
    const modalActions = document.getElementById('sync-modal-actions');

    const result = await resolveSync(stateRef, action, () => {
        analyzeDataset();
    }, () => {
        if (conflictUi) conflictUi.style.display = 'none';
        if (modalActions) modalActions.style.display = 'flex';
        updateStats();
        applyFilters();
        loadSyncModalState();
    });

    if (result === false) { // cancel connection
        if (conflictUi) conflictUi.style.display = 'none';
        if (modalActions) modalActions.style.display = 'flex';
        if (DOM.connectBtn) {
            DOM.connectBtn.disabled = false;
            DOM.connectBtn.textContent = 'Connect & Sync';
        }
    }
}

// Question actions
export function toggleCompleted(sig) {
    if (!stateRef) return;
    if (stateRef.completedSet.has(sig)) {
        stateRef.completedSet.delete(sig);
    } else {
        stateRef.completedSet.add(sig);
    }
    stateRef.touchTimestamp(sig);
    stateRef.saveCompleted();
    updateStats();
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

// toggleHidden removed in custom sections upgrade

export function clearAllProgress() {
    if (!stateRef) return;
    
    // Set counts in danger modal
    if (DOM.resetCompletedCount) DOM.resetCompletedCount.textContent = stateRef.completedSet.size;
    if (DOM.resetNotesCount) {
        DOM.resetNotesCount.textContent = Object.keys(stateRef.notes).filter(k => stateRef.notes[k] && stateRef.notes[k].trim()).length;
    }
    if (DOM.resetAnswersCount) {
        DOM.resetAnswersCount.textContent = Object.keys(stateRef.correctAnswers).filter(k => stateRef.correctAnswers[k]).length;
    }
    if (DOM.resetSectionsCount) {
        DOM.resetSectionsCount.textContent = (stateRef.customSections || []).length;
    }

    if (DOM.resetConfirmInput) {
        DOM.resetConfirmInput.value = '';
    }
    if (DOM.confirmResetBtn) {
        DOM.confirmResetBtn.disabled = true;
    }

    if (DOM.resetConfirmModal) {
        DOM.resetConfirmModal.classList.add('active');
    }
}

export function closeResetModal() {
    if (DOM.resetConfirmModal) {
        DOM.resetConfirmModal.classList.remove('active');
    }
}

export function downloadBackup() {
    if (!stateRef) return;
    const typeLabel = 'UPTET';
    const filenamePrefix = 'uptet-backup';
    const dateStr = new Date().toISOString().slice(0, 10);

    const backup = {
        exportedAt: new Date().toISOString(),
        dashboard: typeLabel,
        completed: Array.from(stateRef.completedSet),
        notes: stateRef.notes,
        correctAnswers: stateRef.correctAnswers,
        tagOverrides: stateRef.tagOverrides,
        customSections: stateRef.customSections || [],
        customTags: stateRef.customTags || {},
        timestamps: stateRef.timestamps || {}
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function executeProgressReset() {
    if (!stateRef) return;
    if (DOM.resetConfirmInput && DOM.resetConfirmInput.value !== 'RESET') return;

    stateRef.clearAllProgress();
    analyzeDataset();
    updateStats();
    applyFilters();
    closeResetModal();

    alert('All local progress has been reset. Note: Cloud synchronization was not automatically updated to allow recovery. If this was a mistake, you can restore from your downloaded backup.');
}

// Notes
export function toggleNoteEditor(sig) {
    if (!stateRef) return;
    
    // Find the question to get context
    const q = stateRef.questions.find(item => {
        const itemSig = `${item.pdf_name || ''}_${item.page || 0}_${item.col_idx || 0}_${item.id || ''}_${item.text || ''}`;
        return itemSig === sig;
    });

    if (!q) return;

    currentEditingSig = sig;

    // Find card elements to extract the relative question number displayed in UI
    const noteContainer = document.getElementById(`note-container-${sig}`);
    const cardElement = noteContainer ? noteContainer.closest('.q-card') : null;
    const qBadgeText = cardElement ? cardElement.querySelector('.q-number-badge').textContent : `Q`;

    // Setup modal contents
    if (DOM.noteModalTitle) DOM.noteModalTitle.textContent = `Edit Study Notes`;
    if (DOM.noteModalQBadge) DOM.noteModalQBadge.textContent = qBadgeText;
    if (DOM.noteModalQText) DOM.noteModalQText.innerHTML = stateRef.config.getQuestionText(q);
    if (DOM.noteModalTextarea) {
        DOM.noteModalTextarea.value = stateRef.notes[sig] || '';
    }

    // Show modal
    if (DOM.noteEditorModal) {
        DOM.noteEditorModal.classList.add('active');
        if (DOM.noteModalTextarea) {
            DOM.noteModalTextarea.focus();
        }
    }
}

export function editNote(sig) {
    toggleNoteEditor(sig);
}

export function cancelNoteEdit(sig) {
    // Left as stub for backward compatibility
}

export function closeNoteEditorModal() {
    if (DOM.noteEditorModal) {
        DOM.noteEditorModal.classList.remove('active');
    }
    currentEditingSig = null;
}

export function executeSaveNoteModal() {
    if (!currentEditingSig) return;
    const noteVal = DOM.noteModalTextarea ? DOM.noteModalTextarea.value : '';
    saveNote(currentEditingSig, noteVal);
    closeNoteEditorModal();
}

export function saveNote(sig, value) {
    if (!stateRef) return;
    const trimmedVal = value.trim();
    if (trimmedVal) {
        stateRef.notes[sig] = trimmedVal;
    } else {
        delete stateRef.notes[sig];
    }
    stateRef.touchTimestamp(sig);
    stateRef.saveNotes();
    updateStats();
    
    const noteContainer = document.getElementById(`note-container-${sig}`);
    if (noteContainer) {
        const cardElement = noteContainer.closest('.q-card');
        let badgeRow = cardElement.querySelector('.badge-row');
        let existingIndicator = badgeRow.querySelector('.note-indicator-badge');
        const noteBtn = cardElement.querySelector('.note-btn');

        if (trimmedVal) {
            if (!existingIndicator) {
                const badge = document.createElement('span');
                badge.className = 'note-indicator-badge';
                badge.style.cssText = "background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;";
                badge.innerHTML = `<i data-lucide="sticky-note" style="width: 12px; height: 12px;"></i> Has Note`;
                badgeRow.appendChild(badge);
                refreshIcons();
            }
            if (noteBtn) {
                noteBtn.classList.add('active');
                noteBtn.style.borderColor = '#f59e0b';
                noteBtn.style.color = '#f59e0b';
            }

            const display = document.getElementById(`note-display-${sig}`);
            if (display) {
                display.innerHTML = getParsedNote(trimmedVal);
                triggerMathRender(display);
                display.style.display = 'block';
            }
            noteContainer.style.display = 'block';
        } else {
            if (existingIndicator) {
                existingIndicator.remove();
            }
            if (noteBtn) {
                noteBtn.classList.remove('active');
                noteBtn.style.borderColor = 'var(--border-color)';
                noteBtn.style.color = 'var(--text-secondary)';
            }
            noteContainer.style.display = 'none';
        }
    }
    
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

export function clearNote(sig) {
    if (confirm("Are you sure you want to clear this note?")) {
        saveNote(sig, '');
    }
}

// Tag Fix metadata overrides
export function toggleTagEditor(sig) {
    const panel = document.getElementById(`tag-editor-${sig}`);
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    
    if (isHidden) {
        const branchSelect = document.getElementById(`edit-branch-${sig}`);
        const bloomSelect = document.getElementById(`edit-bloom-${sig}`);
        
        branchSelect.innerHTML = '';
        bloomSelect.innerHTML = '';
        
        const q = stateRef.questions.find(item => stateRef.config.getSignature(item) === sig);
        if (!q) return;
        
        const overrides = stateRef.tagOverrides[sig] || {};
        const currentBranch = overrides.core_branch || q.metadata?.core_branch || 'General';
        const currentBloom = overrides.bloom_level || q.metadata?.bloom_level || 'Understanding';
        const currentTopic = overrides.topic || q.metadata?.topic || (stateRef.config.copyPrefix === 'Physics' ? 'Concept' : 'General Studies');
        
        // Branch option list
        Object.keys(stateRef.branches).sort().forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            opt.selected = (b === currentBranch);
            branchSelect.appendChild(opt);
        });
        
        // Bloom option levels
        Array.from(stateRef.bloomLevels).sort().forEach(bl => {
            const opt = document.createElement('option');
            opt.value = bl;
            opt.textContent = bl;
            opt.selected = (bl === currentBloom);
            bloomSelect.appendChild(opt);
        });
        
        document.getElementById(`edit-topic-${sig}`).value = currentTopic;
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

export function cancelTagEdit(sig) {
    const panel = document.getElementById(`tag-editor-${sig}`);
    if (panel) panel.style.display = 'none';
}

export function saveTagEdit(sig) {
    if (!stateRef) return;
    const branch = document.getElementById(`edit-branch-${sig}`).value;
    const bloom = document.getElementById(`edit-bloom-${sig}`).value;
    const topic = document.getElementById(`edit-topic-${sig}`).value.trim();
    
    if (!stateRef.tagOverrides[sig]) {
        stateRef.tagOverrides[sig] = {};
    }
    
    stateRef.tagOverrides[sig] = {
        core_branch: branch,
        bloom_level: bloom,
        topic: topic
    };
    
    stateRef.touchTimestamp(sig);
    stateRef.saveTagOverrides();
    
    analyzeDataset();
    updateStats();
    
    const panel = document.getElementById(`tag-editor-${sig}`);
    if (panel) panel.style.display = 'none';
    
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

// Answers
export function toggleAnswerEditor(sig) {
    const panel = document.getElementById(`answer-editor-${sig}`);
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
}

export function saveCorrectAnswer(sig, opt) {
    if (!stateRef) return;
    stateRef.correctAnswers[sig] = opt;
    stateRef.touchTimestamp(sig);
    stateRef.saveCorrectAnswers();
    
    const card = document.getElementById(`answer-editor-${sig}`).closest('.q-card');
    
    const optionItems = card.querySelectorAll('.option-item');
    optionItems.forEach(item => item.classList.remove('correct-answer'));
    
    const labels = ['A', 'B', 'C', 'D'];
    const targetIndex = labels.indexOf(opt);
    if (targetIndex !== -1 && optionItems[targetIndex]) {
        optionItems[targetIndex].classList.add('correct-answer');
    }
    
    let badgeRow = card.querySelector('.badge-row');
    let existingIndicator = badgeRow.querySelector('.answer-indicator-badge');
    if (existingIndicator) {
        existingIndicator.innerHTML = `<i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Ans: ${opt}`;
    } else {
        const badge = document.createElement('span');
        badge.className = 'answer-indicator-badge';
        badge.style.cssText = "background: rgba(16, 185, 129, 0.15); color: var(--success-color); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;";
        badge.innerHTML = `<i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Ans: ${opt}`;
        badgeRow.appendChild(badge);
    }
    
    const ansBtn = card.querySelector('.answer-btn');
    ansBtn.classList.add('active');
    ansBtn.style.borderColor = 'var(--success-color)';
    ansBtn.style.color = 'var(--success-color)';
    
    document.getElementById(`answer-editor-${sig}`).style.display = 'none';
    
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

export function clearCorrectAnswer(sig) {
    if (!stateRef) return;
    delete stateRef.correctAnswers[sig];
    stateRef.touchTimestamp(sig);
    stateRef.saveCorrectAnswers();
    
    const card = document.getElementById(`answer-editor-${sig}`).closest('.q-card');
    const optionItems = card.querySelectorAll('.option-item');
    optionItems.forEach(item => item.classList.remove('correct-answer'));
    
    let badgeRow = card.querySelector('.badge-row');
    let existingIndicator = badgeRow.querySelector('.answer-indicator-badge');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const ansBtn = card.querySelector('.answer-btn');
    ansBtn.classList.remove('active');
    ansBtn.style.borderColor = 'var(--border-color)';
    ansBtn.style.color = 'var(--text-secondary)';
    
    document.getElementById(`answer-editor-${sig}`).style.display = 'none';
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

// Deletions
export function toggleDeleteConfirm(sig) {
    const panel = document.getElementById(`delete-confirm-${sig}`);
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
}

export function cancelDelete(sig) {
    const panel = document.getElementById(`delete-confirm-${sig}`);
    if (panel) panel.style.display = 'none';
}

export function confirmDelete(sig) {
    if (!stateRef) return;
    stateRef.deletedSet.add(sig);
    stateRef.touchTimestamp(sig);
    stateRef.saveDeleted();
    
    const card = document.getElementById(`delete-confirm-${sig}`).closest('.q-card');
    card.style.transition = 'all 0.5s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        applyFilters();
    }, 500);
    
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

// Open Google AI
export function openGoogleAI(sig) {
    if (!stateRef) return;
    const q = stateRef.questions.find(item => stateRef.config.getSignature(item) === sig);
    if (!q) return;

    const qText = stateRef.config.getQuestionText(q);
    const opts = stateRef.config.getOptions(q);
    const prompt = stateRef.config.cleanPromptText(`${qText} (A) ${opts.A} (B) ${opts.B} (C) ${opts.C} (D) ${opts.D}`);
    const url = `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
    window.open(url, "_blank");
}

// Copy clipboard
export function copyQuestion(button, sig) {
    if (!stateRef) return;
    const q = stateRef.questions.find(item => stateRef.config.getSignature(item) === sig);
    if (!q) return;

    const qText = stateRef.config.getQuestionText(q);
    const opts = stateRef.config.getOptions(q);
    
    // Retrieve metadata (respect overrides)
    const overrides = stateRef.tagOverrides[sig] || {};
    const branch = overrides.core_branch || q.metadata?.core_branch || 'General';
    const topic = overrides.topic || q.metadata?.topic || (stateRef.config.copyPrefix === 'Physics' ? 'Concept' : 'General Studies');
    const bloom = overrides.bloom_level || q.metadata?.bloom_level || 'Understanding';

    const label = stateRef.config.copyPrefix === 'Physics' ? 'Physics' : 'GS';
    const formatted = `[${label} | ${branch} - ${topic} | ${bloom}]\n${qText}\n(A) ${opts.A}\n(B) ${opts.B}\n(C) ${opts.C}\n(D) ${opts.D}`;
    
    navigator.clipboard.writeText(formatted).then(() => {
        button.classList.add('copied');
        button.innerHTML = `<i data-lucide="check" style="width: 16px; height: 16px;"></i> Copied!`;
        refreshIcons();
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = `<i data-lucide="copy" style="width: 16px; height: 16px;"></i> Copy`;
            refreshIcons();
        }, 2000);
    });
}

// Custom Sections Widgets & Handlers
export function renderSectionsWidget() {
    if (!stateRef || !DOM.sectionList) return;

    // Calculate counts
    let totalCount = 0;
    let activeCount = 0;
    let completedCount = 0;
    let notesCount = 0;
    const customCounts = {};
    (stateRef.customSections || []).forEach(s => {
        customCounts[s.id] = 0;
    });

    stateRef.questions.forEach(q => {
        const sig = stateRef.config.getSignature(q);
        if (stateRef.deletedSet.has(sig)) return;

        totalCount++;

        const isCompleted = stateRef.completedSet.has(sig);
        const hasNote = stateRef.notes[sig] && stateRef.notes[sig].trim();

        if (isCompleted) {
            completedCount++;
        } else {
            activeCount++;
        }

        if (hasNote) {
            notesCount++;
        }

        // Custom section tags
        const tags = stateRef.customTags[sig] || [];
        tags.forEach(tagId => {
            if (tagId in customCounts) {
                customCounts[tagId]++;
            }
        });
    });

    // Render HTML
    let html = `
        <li class="section-item ${stateRef.sectionFilter === 'all' ? 'active' : ''}" onclick="selectSection('all')">
            <span>All Questions</span>
            <span class="section-count">${totalCount}</span>
        </li>
        <li class="section-item ${stateRef.sectionFilter === 'active' ? 'active' : ''}" onclick="selectSection('active')">
            <span>Active</span>
            <span class="section-count">${activeCount}</span>
        </li>
        <li class="section-item ${stateRef.sectionFilter === 'completed' ? 'active' : ''}" onclick="selectSection('completed')">
            <span>Completed</span>
            <span class="section-count">${completedCount}</span>
        </li>
        <li class="section-item ${stateRef.sectionFilter === 'notes' ? 'active' : ''}" onclick="selectSection('notes')">
            <span>Notes</span>
            <span class="section-count">${notesCount}</span>
        </li>
    `;

    if ((stateRef.customSections || []).length > 0) {
        html += `
            <div class="dropdown-divider"></div>
            <div class="dropdown-section-title" style="padding-left: 0.5rem; margin-bottom: 0.25rem;">Custom Lists</div>
        `;
        stateRef.customSections.forEach(s => {
            html += `
                <li class="section-item ${stateRef.sectionFilter === s.id ? 'active' : ''}" onclick="selectSection('${s.id}')" style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="folder" style="width: 14px; height: 14px; color: var(--accent-color);"></i>
                        <span>${s.name}</span>
                    </span>
                    <span style="display: flex; align-items: center; gap: 0.25rem;">
                        <span class="section-count">${customCounts[s.id] || 0}</span>
                        <button class="rename-section-btn" onclick="event.stopPropagation(); openRenameSectionModal('${s.id}')" style="background: none; border: none; padding: 0.2rem; cursor: pointer; color: var(--text-secondary); transition: var(--transition-smooth); display: flex; align-items: center; justify-content: center; border-radius: 4px;" title="Rename Section">
                            <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="delete-section-btn" onclick="event.stopPropagation(); openDeleteSectionModal('${s.id}')" style="background: none; border: none; padding: 0.2rem; cursor: pointer; color: var(--text-secondary); transition: var(--transition-smooth); display: flex; align-items: center; justify-content: center; border-radius: 4px;" title="Delete Section">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </span>
                </li>
            `;
        });
    }

    DOM.sectionList.innerHTML = html;
    updateLinkToggleUI();
}

export function updateLinkToggleUI() {
    if (!DOM.linkToggleIcon || !DOM.linkToggleBtn) return;
    const isLinked = stateRef.sectionLinkMode === 'linked';
    
    if (isLinked) {
        DOM.linkToggleIcon.setAttribute('data-lucide', 'link');
        DOM.linkToggleBtn.style.color = 'var(--accent-color)';
        DOM.linkToggleBtn.title = "Sections linked to subjects (stacking)";
    } else {
        DOM.linkToggleIcon.setAttribute('data-lucide', 'link-2-off');
        DOM.linkToggleBtn.style.color = 'var(--text-secondary)';
        DOM.linkToggleBtn.title = "Sections unlinked from subjects (global list)";
    }

    const shouldDimBranches = (!isLinked && stateRef.sectionFilter !== 'all');
    if (shouldDimBranches) {
        document.getElementById('branches-list')?.classList.add('dimmed');
    } else {
        document.getElementById('branches-list')?.classList.remove('dimmed');
    }

    refreshIcons();
}

export function toggleSectionLinkMode() {
    if (!stateRef) return;
    stateRef.sectionLinkMode = stateRef.sectionLinkMode === 'linked' ? 'unlinked' : 'linked';
    localStorage.setItem('sectionLinkMode', stateRef.sectionLinkMode);

    // Adjust top tabs active state based on the new link mode and current filters
    const isCustom = !['all', 'active', 'completed', 'notes'].includes(stateRef.sectionFilter);
    if (isCustom) {
        const activeBtn = document.getElementById('status-btn-active');
        const completedBtn = document.getElementById('status-btn-completed');
        const notesBtn = document.getElementById('status-btn-notes');
        if (stateRef.sectionLinkMode === 'unlinked') {
            if (activeBtn) activeBtn.classList.remove('active');
            if (completedBtn) completedBtn.classList.remove('active');
            if (notesBtn) notesBtn.classList.remove('active');
        } else {
            const filter = stateRef.currentStatusFilter;
            if (activeBtn) activeBtn.classList.toggle('active', filter === 'active');
            if (completedBtn) completedBtn.classList.toggle('active', filter === 'completed');
            if (notesBtn) notesBtn.classList.toggle('active', filter === 'notes');
        }
    }

    updateLinkToggleUI();
    applyFilters();
}

export function openAddSectionModal() {
    if (DOM.addSectionModal) {
        DOM.addSectionModal.classList.add('active');
        if (DOM.newSectionNameInput) {
            DOM.newSectionNameInput.value = '';
            DOM.newSectionNameInput.focus();
        }
    }
}

export function closeAddSectionModal() {
    if (DOM.addSectionModal) {
        DOM.addSectionModal.classList.remove('active');
    }
}

export function createCustomSection() {
    if (!stateRef || !DOM.newSectionNameInput) return;
    const name = DOM.newSectionNameInput.value.trim();
    if (!name) return;

    const id = 'cs-' + Date.now(); // unique ID
    
    if (!stateRef.customSections) {
        stateRef.customSections = [];
    }
    
    // Check for duplicate names (case-insensitive)
    if (stateRef.customSections.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert('A section with this name already exists.');
        return;
    }

    stateRef.customSections.push({ id, name });
    stateRef.saveCustomSections();
    
    closeAddSectionModal();
    updateStats();
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

export function selectSection(filter) {
    if (!stateRef) return;
    stateRef.sectionFilter = filter;
    
    const isCustom = !['all', 'active', 'completed', 'notes'].includes(filter);
    const activeBtn = document.getElementById('status-btn-active');
    const completedBtn = document.getElementById('status-btn-completed');
    const notesBtn = document.getElementById('status-btn-notes');

    if (isCustom) {
        if (stateRef.sectionLinkMode === 'unlinked') {
            // Deactivate top status buttons
            if (activeBtn) activeBtn.classList.remove('active');
            if (completedBtn) completedBtn.classList.remove('active');
            if (notesBtn) notesBtn.classList.remove('active');
        } else {
            // Linked mode: Make sure the correct status button is highlighted
            const status = stateRef.currentStatusFilter;
            if (activeBtn) activeBtn.classList.toggle('active', status === 'active');
            if (completedBtn) completedBtn.classList.toggle('active', status === 'completed');
            if (notesBtn) notesBtn.classList.toggle('active', status === 'notes');
        }
    } else {
        // If clicking a built-in section, update our top status buttons and state
        if (filter !== 'all') {
            stateRef.currentStatusFilter = filter;
        }
        const statusToHighlight = filter === 'all' ? stateRef.currentStatusFilter : filter;
        if (activeBtn) activeBtn.classList.toggle('active', statusToHighlight === 'active');
        if (completedBtn) completedBtn.classList.toggle('active', statusToHighlight === 'completed');
        if (notesBtn) notesBtn.classList.toggle('active', statusToHighlight === 'notes');
    }

    applyFilters();
    updateStats();
    renderSectionsWidget();
}

export function toggleCustomSectionTag(sig, sectionId) {
    if (!stateRef) return;
    if (!stateRef.customTags[sig]) {
        stateRef.customTags[sig] = [];
    }
    
    let tags = stateRef.customTags[sig];
    if (tags.includes(sectionId)) {
        tags = tags.filter(t => t !== sectionId);
    } else {
        tags.push(sectionId);
    }
    stateRef.customTags[sig] = tags;
    stateRef.touchTimestamp(sig);
    stateRef.saveCustomTags();
    
    updateStats();
    applyFilters();
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

export function toggleDropdown(sig) {
    const dropdown = document.getElementById(`dropdown-menu-${sig}`);
    if (!dropdown) return;
    const isActive = dropdown.classList.contains('active');
    
    // Close all other dropdowns first
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('active'));
    
    if (!isActive) {
        dropdown.classList.add('active');
    }
}

let pendingDeleteSectionId = null;

export function openDeleteSectionModal(sectionId) {
    if (!stateRef) return;
    const section = stateRef.customSections.find(s => s.id === sectionId);
    if (!section) return;

    pendingDeleteSectionId = sectionId;
    if (DOM.deleteSectionName) {
        DOM.deleteSectionName.textContent = section.name;
    }
    if (DOM.deleteSectionModal) {
        DOM.deleteSectionModal.classList.add('active');
    }
}

export function closeDeleteSectionModal() {
    pendingDeleteSectionId = null;
    if (DOM.deleteSectionModal) {
        DOM.deleteSectionModal.classList.remove('active');
    }
}

export function executeDeleteSection(makeCompleted) {
    if (!stateRef || !pendingDeleteSectionId) return;

    const sectionId = pendingDeleteSectionId;

    // Loop through all customTags to find questions with this sectionTag
    Object.keys(stateRef.customTags).forEach(sig => {
        const tags = stateRef.customTags[sig] || [];
        if (tags.includes(sectionId)) {
            // Remove the tag from customTags
            stateRef.customTags[sig] = tags.filter(t => t !== sectionId);
            stateRef.touchTimestamp(sig);

            // Move question to Active (uncompleted) or Completed as requested
            if (makeCompleted) {
                stateRef.completedSet.add(sig);
            } else {
                stateRef.completedSet.delete(sig);
            }
        }
    });

    // Remove the custom section from customSections list
    stateRef.customSections = stateRef.customSections.filter(s => s.id !== sectionId);

    // If we are currently filtering by the deleted section, reset filter to 'all'
    if (stateRef.sectionFilter === sectionId) {
        stateRef.sectionFilter = 'all';
    }

    // Save state changes
    stateRef.saveCustomSections();
    stateRef.saveCustomTags();
    stateRef.saveCompleted();

    // Close modal
    closeDeleteSectionModal();

    // Update UI
    updateStats();
    applyFilters();

    // Sync with cloud
    debouncedSync(stateRef, () => {
        updateStats();
        applyFilters();
    });
}

let pendingRenameSectionId = null;

export function openRenameSectionModal(sectionId) {
    if (!stateRef) return;
    const section = stateRef.customSections.find(s => s.id === sectionId);
    if (!section) return;

    pendingRenameSectionId = sectionId;
    if (DOM.renameSectionInput) {
        DOM.renameSectionInput.value = section.name;
    }
    if (DOM.renameSectionModal) {
        DOM.renameSectionModal.classList.add('active');
        setTimeout(() => {
            DOM.renameSectionInput.focus();
        }, 50);
    }
}

export function closeRenameSectionModal() {
    pendingRenameSectionId = null;
    if (DOM.renameSectionModal) {
        DOM.renameSectionModal.classList.remove('active');
    }
}

export function executeRenameSection() {
    if (!stateRef || !pendingRenameSectionId || !DOM.renameSectionInput) return;

    const newName = DOM.renameSectionInput.value.trim();
    if (!newName) return;

    // Check duplicate name (except itself)
    const duplicate = stateRef.customSections.some(s => s.id !== pendingRenameSectionId && s.name.toLowerCase() === newName.toLowerCase());
    if (duplicate) {
        alert('A section with this name already exists.');
        return;
    }

    const section = stateRef.customSections.find(s => s.id === pendingRenameSectionId);
    if (section) {
        section.name = newName;
        stateRef.saveCustomSections();
        closeRenameSectionModal();
        updateStats();
        applyFilters();
        debouncedSync(stateRef, () => {
            updateStats();
            applyFilters();
        });
    }
}

