/**
 * ABDC Database Plugin
 *
 * Australian Business Deans Council Journal Quality List matching.
 * Data source: abdcRankings global object from data.js
 */

/* global MatchingUtils, DatabaseRegistry, abdcRankings */

var ABDCDatabase = {
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
		var byTitle = abdcRankings.byTitle || {};
		var exact = title.trim().toLowerCase();
		if (byTitle[exact]) {
			return byTitle[exact];
		}

		var normalized = MatchingUtils.normalizeString(title);
		for (var abdcTitle in byTitle) {
			if (MatchingUtils.normalizeString(abdcTitle) === normalized) {
				return byTitle[abdcTitle];
			}
		}
		return null;
	},

	match: function(title, debugLog, item) {
		debugLog('[ABDC] Retrieving ranking from database...');

		var byIssn = abdcRankings.byIssn || {};
		var issns = this.extractIssns(item);
		for (var i = 0; i < issns.length; i++) {
			if (byIssn[issns[i]]) {
				debugLog('[ABDC] ✓ ISSN match: ' + issns[i] + ' -> ' + byIssn[issns[i]].abdc);
				return byIssn[issns[i]].abdc;
			}
		}

		var entry = this.findByTitle(title);
		if (entry) {
			debugLog('[ABDC] ✓ Title match -> ' + entry.abdc);
			return entry.abdc;
		}

		debugLog('[ABDC] Journal NOT found: "' + title + '"');
		return null;
	}
};

DatabaseRegistry.register({
	id: 'abdc',
	name: 'ABDC Journal Quality List',
	prefKey: 'enableABDC',
	priority: 102,
	matcher: function(title, debugLog, item) {
		return ABDCDatabase.match(title, debugLog, item);
	}
});
