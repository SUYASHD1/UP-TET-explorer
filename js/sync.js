/**
 * Gist Sync Engine
 */

let syncTimeout = null;
let pendingSyncData = null;
let pendingToken = null;
let pendingGistId = null;

/**
 * 30-day Last-Write-Wins Merge logic
 */
export function mergeDatasets(local, remote) {
    const merged = {
        completed: [],
        deleted: [],
        notes: {},
        tagOverrides: {},
        correctAnswers: {},
        timestamps: {},
        customSections: [],
        customTags: {}
    };

    const localTagOverrides = local.tagOverrides || local.tag_overrides || {};
    const remoteTagOverrides = remote.tagOverrides || remote.tag_overrides || {};
    const localCorrectAnswers = local.correctAnswers || local.correct_answers || {};
    const remoteCorrectAnswers = remote.correctAnswers || remote.correct_answers || {};

    const allSigs = new Set([
        ...Object.keys(local.timestamps || {}),
        ...Object.keys(remote.timestamps || {}),
        ...(local.completed || []), ...(remote.completed || []),
        ...(local.deleted || []), ...(remote.deleted || []),
        ...Object.keys(local.notes || {}), ...Object.keys(remote.notes || {}),
        ...Object.keys(localTagOverrides), ...Object.keys(remoteTagOverrides),
        ...Object.keys(localCorrectAnswers), ...Object.keys(remoteCorrectAnswers)
    ]);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    allSigs.forEach(sig => {
        const localTime = (local.timestamps && local.timestamps[sig]) || 0;
        const remoteTime = (remote.timestamps && remote.timestamps[sig]) || 0;

        let winner;
        if (localTime === 0 && remoteTime === 0) {
            const isCompleted = (local.completed && local.completed.includes(sig)) || (remote.completed && remote.completed.includes(sig));
            const isDeleted = (local.deleted && local.deleted.includes(sig)) || (remote.deleted && remote.deleted.includes(sig));
            const noteVal = (local.notes && local.notes[sig]) || (remote.notes && remote.notes[sig]);
            const tagsVal = localTagOverrides[sig] || remoteTagOverrides[sig];
            const ansVal = localCorrectAnswers[sig] || remoteCorrectAnswers[sig];

            if (isCompleted) merged.completed.push(sig);
            if (isDeleted) merged.deleted.push(sig);
            if (noteVal) merged.notes[sig] = noteVal;
            if (tagsVal) merged.tagOverrides[sig] = tagsVal;
            if (ansVal) merged.correctAnswers[sig] = ansVal;
            return;
        } else if (localTime >= remoteTime) {
            winner = 'local';
        } else {
            winner = 'remote';
        }

        const source = winner === 'local' ? local : remote;
        const sourceTagOverrides = winner === 'local' ? localTagOverrides : remoteTagOverrides;
        const sourceCorrectAnswers = winner === 'local' ? localCorrectAnswers : remoteCorrectAnswers;
        const winnerTime = winner === 'local' ? localTime : remoteTime;

        const isCompleted = source.completed && source.completed.includes(sig);
        const isDeleted = source.deleted && source.deleted.includes(sig);
        const noteVal = source.notes && source.notes[sig];
        const tagsVal = sourceTagOverrides[sig];
        const ansVal = sourceCorrectAnswers[sig];

        if (isCompleted) merged.completed.push(sig);
        if (isDeleted) merged.deleted.push(sig);
        if (noteVal) merged.notes[sig] = noteVal;
        if (tagsVal) merged.tagOverrides[sig] = tagsVal;
        if (ansVal) merged.correctAnswers[sig] = ansVal;

        if (winnerTime > cutoff) {
            merged.timestamps[sig] = winnerTime;
        }
    });

    const sectionsMap = new Map();
    (local.customSections || []).forEach(s => {
        if (s && s.id) sectionsMap.set(s.id, s);
    });
    (remote.customSections || []).forEach(s => {
        if (s && s.id) sectionsMap.set(s.id, s);
    });
    merged.customSections = Array.from(sectionsMap.values());

    const localTags = local.customTags || {};
    const remoteTags = remote.customTags || {};
    const allTagSigs = new Set([...Object.keys(localTags), ...Object.keys(remoteTags)]);
    allTagSigs.forEach(sig => {
        const unionTags = new Set([
            ...(localTags[sig] || []),
            ...(remoteTags[sig] || [])
        ]);
        merged.customTags[sig] = Array.from(unionTags);
    });

    return merged;
}

/**
 * Debounced Sync trigger
 */
export function debouncedSync(state, callback) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => performSync(state, callback), 5000);
}

/**
 * Performs full fetch-merge-patch sync cycle
 */
export async function performSync(state, callback) {
    const token = localStorage.getItem('uptet_github_token');
    const gistId = localStorage.getItem('uptet_gist_id');
    if (!token || !gistId) return;

    console.log("Syncing progress with GitHub Gist...");
    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (!response.ok) throw new Error("Remote fetch failed");

        const gistData = await response.json();
        const gistFile = state.config.gistFile;
        
        if (gistData.files[gistFile]) {
            const content = gistData.files[gistFile].content;
            const remote = JSON.parse(content || '{"completed":[],"hidden":[],"notes":{},"tagOverrides":{},"correctAnswers":{},"deleted":[],"customSections":[],"customTags":{}}');

            if (remote.hidden && remote.hidden.length > 0) {
                state.migrateHiddenToCustomSection(remote);
            }

            const local = {
                completed: Array.from(state.completedSet),
                deleted: Array.from(state.deletedSet),
                notes: state.notes,
                tagOverrides: state.tagOverrides,
                correctAnswers: state.correctAnswers,
                timestamps: state.timestamps,
                customSections: state.customSections,
                customTags: state.customTags
            };

            const merged = mergeDatasets(local, remote);

            state.completedSet = new Set(merged.completed);
            state.deletedSet = new Set(merged.deleted);
            state.notes = merged.notes;
            state.tagOverrides = merged.tagOverrides;
            state.correctAnswers = merged.correctAnswers;
            state.timestamps = merged.timestamps;
            state.customSections = merged.customSections;
            state.customTags = merged.customTags;

            state.saveCompleted();
            state.saveDeleted();
            state.saveNotes();
            state.saveTagOverrides();
            state.saveCorrectAnswers();
            state.saveCustomSections();
            state.saveCustomTags();
            localStorage.setItem(state.config.storageKeys.timestamps, JSON.stringify(state.timestamps));

            state.hiddenSet.clear();
            localStorage.removeItem(state.config.storageKeys.hidden);

            if (callback) callback();

            await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        [gistFile]: {
                            "content": JSON.stringify(merged)
                        }
                    }
                })
            });
            console.log("GitHub sync successful.");
        }
    } catch (err) {
        console.error("Gist sync error:", err);
    }
}

/**
 * Upload local state to GitHub Gist
 */
export async function uploadToGist(state) {
    const token = localStorage.getItem('uptet_github_token');
    const gistId = localStorage.getItem('uptet_gist_id');
    if (!token || !gistId) return;

    const gistFile = state.config.gistFile;
    try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [gistFile]: {
                        "content": JSON.stringify({
                            completed: Array.from(state.completedSet),
                            deleted: Array.from(state.deletedSet),
                            notes: state.notes,
                            tagOverrides: state.tagOverrides,
                            correctAnswers: state.correctAnswers,
                            timestamps: state.timestamps,
                            customSections: state.customSections,
                            customTags: state.customTags
                        })
                    }
                }
            })
        });
        console.log("Cloud sync upload success.");
    } catch (err) {
        console.error("Cloud sync upload failed: ", err);
    }
}

/**
 * Connects GitHub Account
 */
export async function connectGitHub(state, token, uiElements, onConflict, onSuccess, onError) {
    try {
        const response = await fetch('https://api.github.com/gists', {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!response.ok) {
            throw new Error("Invalid GitHub token or network error.");
        }

        const gists = await response.json();
        let targetGist = gists.find(g => g.description === "UPTET Explorer Sync Data");
        let gistId = targetGist ? targetGist.id : null;
        const gistFile = state.config.gistFile;

        if (gistId) {
            const gistResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: { 'Authorization': `token ${token}` }
            });
            const gistData = await gistResponse.json();
            
            if (gistData.files[gistFile]) {
                const content = gistData.files[gistFile].content;
                const parsed = JSON.parse(content || '{"completed":[],"hidden":[],"notes":{},"tagOverrides":{},"correctAnswers":{},"deleted":[],"customSections":[],"customTags":{}}');
                
                if (parsed.hidden && parsed.hidden.length > 0) {
                    state.migrateHiddenToCustomSection(parsed);
                }

                pendingSyncData = parsed;
                pendingToken = token;
                pendingGistId = gistId;
                
                onConflict();
                return;
            }
        }

        const gistFilesObj = {};
        gistFilesObj[gistFile] = {
            "content": JSON.stringify({
                completed: Array.from(state.completedSet),
                deleted: Array.from(state.deletedSet),
                notes: state.notes,
                tagOverrides: state.tagOverrides,
                correctAnswers: state.correctAnswers,
                timestamps: state.timestamps,
                customSections: state.customSections,
                customTags: state.customTags
            })
        };

        if (gistId) {
            await fetch(`https://api.github.com/gists/${gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: gistFilesObj
                })
            });
        } else {
            const createResponse = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: "UPTET Explorer Sync Data",
                    public: false,
                    files: gistFilesObj
                })
            });

            const newGist = await createResponse.json();
            gistId = newGist.id;
        }

        localStorage.setItem('uptet_github_token', token);
        localStorage.setItem('uptet_gist_id', gistId);
        
        await uploadToGist(state);
        onSuccess();
    } catch (err) {
        onError(err);
    }
}

/**
 * Disconnects GitHub Sync
 */
export function disconnectGitHub(state, onSuccess) {
    if (confirm("Are you sure you want to disconnect your GitHub Cloud Sync? (Local progress will remain safe)")) {
        localStorage.removeItem('uptet_github_token');
        localStorage.removeItem('uptet_gist_id');
        localStorage.removeItem(state.config.storageKeys.timestamps);
        state.timestamps = {};
        onSuccess();
    }
}

/**
 * Resolves Sync Conflicts
 */
export async function resolveSync(state, action, callback, onSuccess) {
    if (action === 'merge') {
        const local = {
            completed: Array.from(state.completedSet),
            deleted: Array.from(state.deletedSet),
            notes: state.notes,
            tagOverrides: state.tagOverrides,
            correctAnswers: state.correctAnswers,
            timestamps: state.timestamps,
            customSections: state.customSections,
            customTags: state.customTags
        };
        const merged = mergeDatasets(local, pendingSyncData);
        state.completedSet = new Set(merged.completed);
        state.deletedSet = new Set(merged.deleted);
        state.notes = merged.notes;
        state.tagOverrides = merged.tagOverrides;
        state.correctAnswers = merged.correctAnswers;
        state.timestamps = merged.timestamps;
        state.customSections = merged.customSections;
        state.customTags = merged.customTags;

        state.saveCompleted();
        state.saveDeleted();
        state.saveNotes();
        state.saveTagOverrides();
        state.saveCorrectAnswers();
        state.saveCustomSections();
        state.saveCustomTags();
        localStorage.setItem(state.config.storageKeys.timestamps, JSON.stringify(state.timestamps));
        
        state.hiddenSet.clear();
        localStorage.removeItem(state.config.storageKeys.hidden);

        if (callback) callback();
    } else if (action === 'pull') {
        state.completedSet = new Set(pendingSyncData.completed || []);
        state.deletedSet = new Set(pendingSyncData.deleted || []);
        state.notes = pendingSyncData.notes || {};
        state.tagOverrides = pendingSyncData.tagOverrides || pendingSyncData.tag_overrides || {};
        state.correctAnswers = pendingSyncData.correctAnswers || pendingSyncData.correct_answers || {};
        state.timestamps = pendingSyncData.timestamps || {};
        state.customSections = pendingSyncData.customSections || [];
        state.customTags = pendingSyncData.customTags || {};
        
        state.saveCompleted();
        state.saveDeleted();
        state.saveNotes();
        state.saveTagOverrides();
        state.saveCorrectAnswers();
        state.saveCustomSections();
        state.saveCustomTags();
        localStorage.setItem(state.config.storageKeys.timestamps, JSON.stringify(state.timestamps));
        
        state.hiddenSet.clear();
        localStorage.removeItem(state.config.storageKeys.hidden);

        if (callback) callback();
    } else if (action === 'push') {
        // If pushing local, we just overwrite remote with whatever is currently in local.
        // We will save credentials first and then perform uploadToGist.
    } else if (action === 'cancel') {
        pendingSyncData = null;
        pendingToken = null;
        pendingGistId = null;
        return false;
    }

    localStorage.setItem('uptet_github_token', pendingToken);
    localStorage.setItem('uptet_gist_id', pendingGistId);
    
    pendingSyncData = null;
    pendingToken = null;
    pendingGistId = null;

    await uploadToGist(state);
    onSuccess();
    return true;
}
