/**
 * JCR Database Plugin
 *
 * Journal Citation Reports matching from a locally generated dataset.
 * Data source: jcrRankings global object from data.js
 */

/* global MatchingUtils, DatabaseRegistry, jcrRankings */

var JCRDatabase = {
	normalizedTitleIndex: null,

	buildIndex: function() {
		if (this.normalizedTitleIndex) {
			return;
		}

		this.normalizedTitleIndex = Object.create(null);
		var byTitle = jcrRankings.byTitle || {};
		for (var title in byTitle) {
			var normalized = MatchingUtils.normalizeString(title);
			if (!this.normalizedTitleIndex[normalized]) {
				this.normalizedTitleIndex[normalized] = byTitle[title];
			}
		}
	},

	normalizeIssn: function(value) {
		var cleaned = (value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
		return cleaned.length === 8 ? cleaned : '';
	},

	extractIssns: function(item) {
		if (!item || !item.getField) {
			return [];
		}

		var issnField = item.getField('ISSN') || '';
		var matches = issnField.match(/[0-9Xx]{4}[- ]?[0-9Xx]{4}/g) || [];
		var issns = [];
		for (var i = 0; i < matches.length; i++) {
			var issn = this.normalizeIssn(matches[i]);
			if (issn && issns.indexOf(issn) === -1) {
				issns.push(issn);
			}
		}
		return issns;
	},

	findByTitle: function(title) {
		this.buildIndex();
		var byTitle = jcrRankings.byTitle || {};
		var exact = title.trim().toLowerCase();
		if (byTitle[exact]) {
			return byTitle[exact];
		}

		var normalized = MatchingUtils.normalizeString(title);
		return this.normalizedTitleIndex[normalized] || null;
	},

	formatResult: function(entry) {
		if (!entry) {
			return null;
		}

		var quartile = entry.jcr || entry.quartile;
		if (!quartile) {
			return null;
		}

		var jif = entry.jif;
		if (jif !== null && typeof jif !== 'undefined' && jif !== '') {
			return quartile + ' ' + jif;
		}

		return quartile;
	},

	match: function(title, debugLog, item) {
		debugLog('[JCR] Retrieving ranking from database...');

		var byIssn = jcrRankings.byIssn || {};
		var issns = this.extractIssns(item);
		for (var i = 0; i < issns.length; i++) {
			if (byIssn[issns[i]]) {
				var issnResult = this.formatResult(byIssn[issns[i]]);
				if (issnResult) {
					debugLog('[JCR] ✓ ISSN match: ' + issns[i] + ' -> ' + issnResult);
					return issnResult;
				}
			}
		}

		var entry = this.findByTitle(title);
		var result = this.formatResult(entry);
		if (result) {
			debugLog('[JCR] ✓ Title match -> ' + result);
			return result;
		}

		debugLog('[JCR] Journal NOT found: "' + title + '"');
		return null;
	}
};

DatabaseRegistry.register({
	id: 'jcr',
	name: 'Journal Citation Reports',
	prefKey: 'enableJCR',
	priority: 1,
	matcher: function(title, debugLog, item) {
		return JCRDatabase.match(title, debugLog, item);
	}
});
