/**
 * Dashboard State Management
 */
export class DashboardState {
    constructor(config) {
        this.config = config;
        
        this.questions = [];
        this.filteredQuestions = [];
        this.displayedCount = 0;
        this.batchSize = 40;

        // Dynamic categories
        this.branches = {};
        this.bloomLevels = new Set();
        this.exams = new Set();
        this.years = new Set();
        this.sources = new Set();

        // Active filters
        this.selectedBranch = 'all';
        this.selectedBloom = 'all';
        this.selectedSource = 'all';
        this.selectedExam = 'all';
        this.selectedYear = 'all';
        this.currentStatusFilter = 'active';
        this.searchTerm = '';
        this.sectionFilter = 'all';
        this.sectionLinkMode = localStorage.getItem('sectionLinkMode') || 'linked';

        this.initLocalData();
    }

    initLocalData() {
        const keys = this.config.storageKeys;
        this.completedSet = new Set(JSON.parse(localStorage.getItem(keys.completed) || '[]'));
        this.hiddenSet = new Set(JSON.parse(localStorage.getItem(keys.hidden) || '[]'));
        this.deletedSet = new Set(JSON.parse(localStorage.getItem(keys.deleted) || '[]'));
        this.notes = JSON.parse(localStorage.getItem(keys.notes) || '{}');
        this.tagOverrides = JSON.parse(localStorage.getItem(keys.tagOverrides) || '{}');
        this.correctAnswers = JSON.parse(localStorage.getItem(keys.correctAnswers) || '{}');
        this.timestamps = JSON.parse(localStorage.getItem(keys.timestamps) || '{}');
        this.customSections = JSON.parse(localStorage.getItem(keys.customSections) || '[]');
        this.customTags = JSON.parse(localStorage.getItem(keys.customTags) || '{}');
        
        this.migrateHiddenToCustomSection();
    }

    touchTimestamp(sig) {
        this.timestamps[sig] = Date.now();
        localStorage.setItem(this.config.storageKeys.timestamps, JSON.stringify(this.timestamps));
    }

    saveNotes() {
        localStorage.setItem(this.config.storageKeys.notes, JSON.stringify(this.notes));
    }

    saveTagOverrides() {
        localStorage.setItem(this.config.storageKeys.tagOverrides, JSON.stringify(this.tagOverrides));
    }

    saveCorrectAnswers() {
        localStorage.setItem(this.config.storageKeys.correctAnswers, JSON.stringify(this.correctAnswers));
    }

    saveCompleted() {
        localStorage.setItem(this.config.storageKeys.completed, JSON.stringify(Array.from(this.completedSet)));
    }


    saveDeleted() {
        localStorage.setItem(this.config.storageKeys.deleted, JSON.stringify(Array.from(this.deletedSet)));
    }

    saveCustomSections() {
        this.touchTimestamp('_sections');
        localStorage.setItem(this.config.storageKeys.customSections, JSON.stringify(this.customSections));
    }

    saveCustomTags() {
        localStorage.setItem(this.config.storageKeys.customTags, JSON.stringify(this.customTags));
    }

    clearAllProgress() {
        this.completedSet.clear();
        this.hiddenSet.clear();
        this.deletedSet.clear();
        this.notes = {};
        this.tagOverrides = {};
        this.correctAnswers = {};
        this.timestamps = {};
        this.customSections = [];
        this.customTags = {};

        const keys = this.config.storageKeys;
        localStorage.removeItem(keys.completed);
        localStorage.removeItem(keys.hidden);
        localStorage.removeItem(keys.deleted);
        localStorage.removeItem(keys.notes);
        localStorage.removeItem(keys.tagOverrides);
        localStorage.removeItem(keys.correctAnswers);
        localStorage.removeItem(keys.timestamps);
        localStorage.removeItem(keys.customSections);
        localStorage.removeItem(keys.customTags);
    }

    migrateHiddenToCustomSection(remotePayload = null) {
        let hiddenList = [];
        if (remotePayload && remotePayload.hidden && remotePayload.hidden.length > 0) {
            hiddenList = remotePayload.hidden;
            delete remotePayload.hidden;
        } else if (!remotePayload && this.hiddenSet && this.hiddenSet.size > 0) {
            hiddenList = Array.from(this.hiddenSet);
        }

        if (hiddenList.length > 0) {
            let sectionId = 'cs-previously-hidden';
            let section = this.customSections.find(s => s.id === sectionId || s.name.toLowerCase() === 'previously hidden');
            if (!section) {
                section = { id: sectionId, name: 'Previously Hidden' };
                this.customSections.push(section);
                this.saveCustomSections();
            }

            hiddenList.forEach(sig => {
                if (!this.customTags[sig]) {
                    this.customTags[sig] = [];
                }
                if (!this.customTags[sig].includes(section.id)) {
                    this.customTags[sig].push(section.id);
                }
            });
            this.saveCustomTags();

            if (!remotePayload) {
                this.hiddenSet.clear();
                localStorage.removeItem(this.config.storageKeys.hidden);
            }
        }
    }
}
