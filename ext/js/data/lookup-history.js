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
        /** @type {import('dictionary').LookupHistoryEntry[]} */
        this._history = [];
        this._minTimeBetweenLookups = 2000; // 2 seconds default
        this._maxHistoryAge = 30 * 24 * 60 * 60 * 1000; // 30 days default
        /** @type {NodeJS.Timeout | null} */
        this._recordLookupTimer = null;
    }

    /**
     * Records a lookup in the history
     * @param {string} term The term that was looked up
     * @returns {Promise<void>}
     */
    async recordLookup(term) {
        const now = Date.now();

        // Clear any existing timer
        if (this._recordLookupTimer !== null) {
            clearTimeout(this._recordLookupTimer);
        }

        // Set a new timer to record the lookup after a delay
        this._recordLookupTimer = setTimeout(async () => {
            const lookup = {
                term,
                timestamp: now,
            };

            try {
                // Load existing history
                const result = await chrome.storage.local.get('lookup_history');
                this._history = result.lookup_history || [];

                // Remove entries older than max age
                this._history = this._history.filter(entry => now - entry.timestamp <= this._maxHistoryAge);

                // Add new lookup at the beginning
                this._history.unshift(lookup);

                // Store back to storage
                await chrome.storage.local.set({ lookup_history: this._history });
            } catch (e) {
                console.error('Failed to store lookup history:', e);
            }
        }, this._minTimeBetweenLookups);
    }

    /**
     * Gets the lookup history
     * @param {number} [maxAge] Optional maximum age in milliseconds
     * @returns {Promise<import('dictionary').LookupHistoryEntry[]>} Array of lookup history entries
     */
    async getHistory(maxAge = undefined) {
        const now = Date.now();
        try {
            const result = await chrome.storage.local.get('lookup_history');
            this._history = result.lookup_history || [];

            // Filter by maxAge if specified, otherwise use default max age
            const effectiveMaxAge = maxAge || this._maxHistoryAge;
            const filteredHistory = this._history.filter(entry => now - entry.timestamp <= effectiveMaxAge);

            // If entries were filtered out, update storage
            if (filteredHistory.length < this._history.length) {
                this._history = filteredHistory;
                await chrome.storage.local.set({ lookup_history: this._history });
            }

            return filteredHistory;
        } catch (e) {
            console.error('Failed to retrieve lookup history:', e);
            return [];
        }
    }

    /**
     * Clears the lookup history
     * @returns {Promise<void>}
     */
    async clearHistory() {
        try {
            await chrome.storage.local.remove('lookup_history');
            this._history = [];
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

    /**
     * Sets the maximum age of the lookup history
     * @param {number} milliseconds Time in milliseconds
     */
    setMaxHistoryAge(milliseconds) {
        this._maxHistoryAge = milliseconds;
    }
}
