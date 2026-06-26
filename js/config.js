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
        getSignature: (q) => q.signature || (q.id ? q.id.toString() : ''),
        renderHeaderBadge: (q) => `${q.exam} | ${q.metadata ? q.metadata.bloom_level : ''} (Q${q.number}) | Year ${q.year}`,
        getQuestionText: (q) => escapeHTML(q.clean_text || q.text),
        getOptions: (q) => escapeOptions(q.clean_options || q.options),
        cleanPromptText: (text) => {
            let clean = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return "Answer this question: " + clean;
        },
        hasTraceBadge: false,
        isTraceOnly: (q) => false
    }
};

