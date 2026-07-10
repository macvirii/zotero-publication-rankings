/**
 * ABS Database Plugin
 *
 * CABS Journal Rankings (ABS) database matching strategies.
 *
 * Data source: absRankings global object from data.js
 */

/* global Zotero, sjrRankings, MatchingUtils, DatabaseRegistry */

var absDatabase = {
	normalizedTitleIndex: null,

	buildIndex: function() {
		if (this.normalizedTitleIndex) {
			return;
		}

		this.normalizedTitleIndex = Object.create(null);
		for (var absTitle in absRankings) {
			var normalized = MatchingUtils.normalizeString(absTitle);
			if (!this.normalizedTitleIndex[normalized]) {
				this.normalizedTitleIndex[normalized] = absRankings[absTitle];
			}
		}
	},

	/**
	* Main Matching Function
    * @param {string} title - Publication title to match
	* @param {Function} debugLog - Debug logging function
	* @returns {string|null} Ranking string (e.g., "1" or "4*") or null if not found
 */
	match: function (title, debugLog) {
		debugLog(`[ABS] Retrieving ranking from database...`);
		this.buildIndex();

		var exact = title.trim().toLowerCase();
		var entry = absRankings[exact] || this.normalizedTitleIndex[MatchingUtils.normalizeString(title)];
		var result = entry ? entry.abs : null;
		if (result && result !== 'N/A') {
			debugLog(`[ABS] ✓ Journal Found -> ${result}`);
			return result;
		}

		debugLog(`[ABS] Journal NOT found: "${title}"`);
		return null;
	}
}

DatabaseRegistry.register({
	id: 'abs',
	name: 'ABS Journal Ranking',
	prefKey: 'enableABS',
	priority: 101,
	matcher: function (title, debugLog) {
		return absDatabase.match(title, debugLog);
    }
})
