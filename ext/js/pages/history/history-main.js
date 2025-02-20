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

import {ThemeController} from '../../app/theme-controller.js';
import {Application} from '../../application.js';
import {LookupHistory} from '../../data/lookup-history.js';
import {SettingsController} from '../settings/settings-controller.js';

class HistoryController {
    /** @type {LookupHistory} */
    _lookupHistory;
    /** @type {HTMLSelectElement | null} */
    _timeRangeSelect;
    /** @type {HTMLButtonElement | null} */
    _clearHistoryButton;
    /** @type {HTMLDivElement | null} */
    _historyEntries;
    /** @type {HTMLDivElement | null} */
    _noHistory;
    /** @type {HTMLDivElement | null} */
    _progressIndicator;
    /** @type {ThemeController} */
    _themeController;

    /**
     *
     * @param {SettingsController} settingsController
     */
    constructor(settingsController) {
        this._lookupHistory = new LookupHistory();
        this._timeRangeSelect = /** @type {HTMLSelectElement | null} */ (document.querySelector('#time-range-select'));
        this._clearHistoryButton = /** @type {HTMLButtonElement | null} */ (document.querySelector('#clear-history-button'));
        this._historyEntries = /** @type {HTMLDivElement | null} */ (document.querySelector('#history-entries'));
        this._noHistory = /** @type {HTMLDivElement | null} */ (document.querySelector('#no-history'));
        this._progressIndicator = /** @type {HTMLDivElement | null} */ (document.querySelector('#progress-indicator'));
        this._themeController = new ThemeController(document.documentElement);
        this._settingsController = settingsController;

        this._setupEventListeners();
        this._initializeTheme();
        this._loadHistory();
    }

    _setupEventListeners() {
        // Time range change handler
        this._timeRangeSelect?.addEventListener('change', () => {
            this._loadHistory();
        });

        // Clear history button handler
        this._clearHistoryButton?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear your lookup history?')) {
                await this._lookupHistory.clearHistory();
                this._loadHistory();
            }
        });

        // Handle clicks on history entries
        this._historyEntries?.addEventListener('click', (e) => {
            const historyEntry = /** @type {Element} */ (e.target)?.closest('.history-entry');
            const term = /** @type {HTMLElement} */ (historyEntry)?.dataset.term;
            if (term) {
                window.open(`/search.html?query=${encodeURIComponent(term)}`, '_blank');
            }
        });
    }

    /**
     * Loads history entries based on the selected time range
     * @returns {Promise<void>}
     */
    async _loadHistory() {
        if (!this._progressIndicator || !this._timeRangeSelect) return;
        this._progressIndicator.hidden = false;

        try {
            const days = parseInt(this._timeRangeSelect.value);
            const maxAge = days === 0 ? undefined : days * 24 * 60 * 60 * 1000;
            const history = await this._lookupHistory.getHistory(maxAge);

            this._renderHistory(history);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            this._progressIndicator.hidden = true;
        }
    }

    /**
     * Renders the history entries to the DOM
     * @param {import('../../../../types/ext/dictionary').LookupHistoryEntry[]} history
     */
    _renderHistory(history) {
        if (!this._historyEntries || !this._noHistory) return;
        this._historyEntries.innerHTML = '';

        if (history.length === 0) {
            this._noHistory.hidden = false;
            return;
        }

        this._noHistory.hidden = true;

        // Group entries by date
        const groupedEntries = this._groupEntriesByDate(history);

        // Render each group
        for (const [date, entries] of groupedEntries) {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = date;
            this._historyEntries.appendChild(dateHeader);

            for (const entry of entries) {
                const entryElement = document.createElement('div');
                entryElement.className = 'history-entry';
                entryElement.dataset.term = entry.term;

                const time = new Date(entry.timestamp).toLocaleTimeString();
                entryElement.innerHTML = `
                    <div class="history-entry-time">${time}</div>
                    <div class="history-entry-term">${entry.term}</div>
                `;

                this._historyEntries.appendChild(entryElement);
            }
        }
    }

    /**
     * Groups history entries by date
     * @param {import('../../../../types/ext/dictionary').LookupHistoryEntry[]} history
     * @returns {Map<string, import('../../../../types/ext/dictionary').LookupHistoryEntry[]>}
     */
    _groupEntriesByDate(history) {
        const groups = new Map();

        for (const entry of history) {
            const date = new Date(entry.timestamp).toLocaleDateString();
            if (!groups.has(date)) {
                groups.set(date, []);
            }
            groups.get(date).push(entry);
        }

        return groups;
    }

    async _initializeTheme() {
        this._themeController.prepare();
        await this._setTheme();
    }

    async _setTheme() {
        this._themeController.theme = (await this._settingsController.getOptions()).general.popupTheme;
        this._themeController.siteOverride = true;
        this._themeController.updateTheme();
    }
}

// Initialize when the DOM is ready
await Application.main(true, async (application) => {
    document.body.hidden = false;

    const settingsController = new SettingsController(application);
    await settingsController.prepare();

    new HistoryController(settingsController);
});
