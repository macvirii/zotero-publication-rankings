/**
 * SPELL Database Plugin
 *
 * SPELL impact percentile matching.
 * Data source: spellRankings global object from data.js
 */

/* global MatchingUtils, DatabaseRegistry, spellRankings */

var SPELLDatabase = {
	displayClass: function(spellClass) {
		switch (spellClass) {
			case 'top10':
				return 'Top 10%';
			case 'next30':
				return '10-40%';
			case 'next30_2':
				return '40-70%';
			case 'bottom30':
				return '70-100%';
			default:
				return spellClass;
		}
	},

	findByTitle: function(title) {
		var byTitle = spellRankings.byTitle || {};
		var exact = title.trim().toLowerCase();
		if (byTitle[exact]) {
			return byTitle[exact];
		}

		var normalized = MatchingUtils.normalizeString(title);
		for (var spellTitle in byTitle) {
			if (MatchingUtils.normalizeString(spellTitle) === normalized) {
				return byTitle[spellTitle];
			}
		}
		return null;
	},

	match: function(title, debugLog) {
		debugLog('[SPELL] Retrieving ranking from database...');

		var entry = this.findByTitle(title);
		if (entry) {
			var result = this.displayClass(entry.spell);
			debugLog('[SPELL] ✓ Title match -> ' + result);
			return result;
		}

		debugLog('[SPELL] Journal NOT found: "' + title + '"');
		return null;
	}
};

DatabaseRegistry.register({
	id: 'spell',
	name: 'SPELL Impact Ranking',
	prefKey: 'enableSPELL',
	priority: 105,
	matcher: function(title, debugLog) {
		return SPELLDatabase.match(title, debugLog);
	}
});
