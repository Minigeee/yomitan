/*
 * Copyright (C) 2024  Yomitan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export class LookupHistory {
    constructor() {
        this._history = new Map();
        this._lastLookupTime = 0;
        this._minTimeBetweenLookups = 2000; // 2 seconds default
    }

    /**
     * Records a lookup in the history
     * @param {string} term The term that was looked up
     * @param {import('dictionary').DictionaryEntry[]} entries The dictionary entries found
     * @returns {Promise<void>}
     */
    async recordLookup(term, entries) {
        const now = Date.now();
        const lastLookup = this._lastLookupTime || 0;

        // Prevent rapid registrations of any term
        if (now - lastLookup < this._minTimeBetweenLookups) {
            return;
        }

        this._lastLookupTime = now;

        const lookup = {
            term,
            timestamp: now,
            entries: entries.map(entry => ({
                definitions: entry.definitions,
                dictionary: entry.dictionaryAlias
            }))
        };

        // Store in memory
        this._history.set(term, lookup);

        // Store in local storage
        try {
            const storageKey = `lookup_history_${term}`;
            await chrome.storage.local.set({ [storageKey]: lookup });
        } catch (e) {
            console.error('Failed to store lookup history:', e);
        }
    }

    /**
     * Gets the lookup history
     * @param {number} [maxAge] Optional maximum age in milliseconds
     * @returns {Promise<Object[]>} Array of lookup history entries
     */
    async getHistory(maxAge = undefined) {
        const now = Date.now();
        const history = [];

        try {
            const storage = await chrome.storage.local.get(null);
            for (const [key, value] of Object.entries(storage)) {
                if (!key.startsWith('lookup_history_')) continue;

                if (maxAge && (now - value.timestamp > maxAge)) {
                    // Remove old entries
                    await chrome.storage.local.remove(key);
                    continue;
                }

                history.push(value);
            }
        } catch (e) {
            console.error('Failed to retrieve lookup history:', e);
        }

        return history.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Clears the lookup history
     * @returns {Promise<void>}
     */
    async clearHistory() {
        try {
            const storage = await chrome.storage.local.get(null);
            const keysToRemove = Object.keys(storage).filter(key => key.startsWith('lookup_history_'));
            await chrome.storage.local.remove(keysToRemove);
            this._history.clear();
            this._lastLookupTime.clear();
        } catch (e) {
            console.error('Failed to clear lookup history:', e);
        }
    }

    /**
     * Sets the minimum time between lookups of the same term
     * @param {number} milliseconds Time in milliseconds
     */
    setMinTimeBetweenLookups(milliseconds) {
        this._minTimeBetweenLookups = milliseconds;
    }
}
