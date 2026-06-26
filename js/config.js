/**
 * Dashboard Configurations
 */

// Helper to prevent < and > from being parsed as broken HTML tags
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeOptions(opts) {
    if (!opts) return {};
    return {
        A: escapeHTML(opts.A),
        B: escapeHTML(opts.B),
        C: escapeHTML(opts.C),
        D: escapeHTML(opts.D)
    };
}

export const CONFIGS = {
    gs: {
        datasetFile: 'questions.json',
        storageKeys: {
            completed: 'uptet_completed',
            hidden: 'uptet_hidden',
            deleted: 'uptet_deleted',
            notes: 'uptet_notes',
            tagOverrides: 'uptet_tag_overrides',
            correctAnswers: 'uptet_correct_answers',
            timestamps: 'uptet_timestamps',
            customSections: 'uptet_custom_sections',
            customTags: 'uptet_custom_tags'
        },
        gistFile: 'uptet_progress.json',
        hasExamFilter: true,
        hasYearFilter: true,
        hasSourceFilter: false,
        getSignature: (q) => {
            if (q.id) return q.id.toString();
            const str = (q.clean_text || q.text) + 
                        ((q.clean_options && q.clean_options.A) || q.options.A || '') + 
                        ((q.clean_options && q.clean_options.B) || q.options.B || '');
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36) + str.length.toString(36);
        },
        renderHeaderBadge: (q) => `${q.exam} | ${q.metadata ? q.metadata.bloom_level : ''} (Q${q.number}) | Year ${q.year}`,
        getQuestionText: (q) => escapeHTML(q.clean_text || q.text),
        getOptions: (q) => escapeOptions(q.clean_options || q.options),
        cleanPromptText: (text) => text,
        hasTraceBadge: false,
        isTraceOnly: (q) => false
    }
};

