/**
 * Dashboard Main Orchestrator
 */
import { CONFIGS } from './config.js';
import { DashboardState } from './state.js';
import { initUI, analyzeDataset, updateStats, applyFilters } from './ui.js';
import { performSync } from './sync.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize GS configuration (mapped to UPTET)
    const config = CONFIGS.gs;
    config.copyPrefix = 'UPTET';

    console.log(`Initializing ${config.copyPrefix} Dashboard...`);

    // 2. Initialize state
    const state = new DashboardState(config);

    // 3. Initialize UI
    initUI(state);

    // 4. Fetch JSON questions dataset
    console.log(`Loading dataset: ${config.datasetFile}...`);
    fetch(config.datasetFile)
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        })
        .then(data => {
            // Map UPTET data to explorer UI compatibility layer
            state.questions = data.map(q => {
                q.clean_text = q.text;
                q.clean_options = q.options;
                
                // Generate a stable and 100% unique signature for each question
                const sigStr = `${q.pdf_name || ''}_${q.page || 0}_${q.col_idx || 0}_${q.id || ''}_${q.text || ''}`;
                let hash = 0;
                for (let i = 0; i < sigStr.length; i++) {
                    const char = sigStr.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                q.signature = 'q_' + Math.abs(hash).toString(36) + '_' + q.id;

                // Map fields to metadata
                q.metadata = {
                    core_branch: q.paper_section || q.section || 'General',
                    topic: q.keyword_tags && q.keyword_tags.length ? q.keyword_tags.join(', ') : (q.subject || 'General'),
                    bloom_level: q.paper || 'Paper 1'
                };
                
                // Map exam to organization
                q.exam = q.exam || 'General';
                
                // Map source_file to test_set_title for dropdown filtering
                q.source_file = q.test_set_title || 'General Set';
                
                // Map number to id
                q.number = q.id;
                
                return q;
            });
            state.filteredQuestions = [...state.questions];
            
            const loader = document.getElementById('loader');
            if (loader) loader.style.display = 'none';

            analyzeDataset();
            updateStats();
            applyFilters();

            // Auto-pull progress if github token exists
            const token = localStorage.getItem('uptet_github_token');
            const gistId = localStorage.getItem('uptet_gist_id');
            if (token && gistId) {
                performSync(state, () => {
                    analyzeDataset();
                    updateStats();
                    applyFilters();
                });
            }
        })
        .catch(error => {
            const loader = document.getElementById('loader');
            const emptyState = document.getElementById('empty-state');
            if (loader) loader.style.display = 'none';
            if (emptyState) {
                emptyState.style.display = 'flex';
                const h3 = emptyState.querySelector('h3');
                const p = emptyState.querySelector('p');
                if (h3) h3.textContent = `Failed to load ${config.copyPrefix} dataset`;
                if (p) p.textContent = `Make sure '${config.datasetFile}' is located in the same folder as this HTML file.`;
            }
            console.error("Error loading JSON:", error);
        });
});

