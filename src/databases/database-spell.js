/**
 * SPELL Database Plugin
 *
 * SPELL impact percentile matching.
 * Data source: spellRankings global object from data.js
 */

/* global MatchingUtils, DatabaseRegistry, spellRankings */

var SPELLDatabase = {
	normalizedTitleIndex: null,

	buildIndex: function() {
		if (this.normalizedTitleIndex) {
			return;
		}

		this.normalizedTitleIndex = Object.create(null);
		var byTitle = spellRankings.byTitle || {};
		for (var title in byTitle) {
			var normalized = MatchingUtils.normalizeString(title);
			if (!this.normalizedTitleIndex[normalized]) {
				this.normalizedTitleIndex[normalized] = byTitle[title];
			}
		}
	},

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
		this.buildIndex();
		var byTitle = spellRankings.byTitle || {};
		var exact = title.trim().toLowerCase();
		if (byTitle[exact]) {
			return byTitle[exact];
		}

		var normalized = MatchingUtils.normalizeString(title);
		return this.normalizedTitleIndex[normalized] || null;
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
