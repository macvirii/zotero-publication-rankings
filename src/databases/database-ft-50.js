/** Financial Times 50 Journal Rankings membership matcher. */
/* global ft50Rankings, MatchingUtils, DatabaseRegistry, SJRDatabase, JCRDatabase, ABDCDatabase, QualisCapesDatabase */

var ft50Database = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== ft50Rankings || !this.index) {
			this.dataset = ft50Rankings;
			this.index = Object.create(null);
			for (var i = 0; i < ft50Rankings.length; i++) {
				var key = String(ft50Rankings[i]).trim().toLowerCase();
				if (!this.index[key]) this.index[key] = [];
				this.index[key].push(ft50Rankings[i]);
			}
		}
		return this.index;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[FT50] Retrieving ranking from database...');
		var inputTitle = MatchingUtils.toNfc(title || '').trim();
		if (!inputTitle) return null;
		var candidates = this.buildIndex()[inputTitle.toLowerCase()] || [];
		if (candidates.length !== 1) {
			if (candidates.length > 1) debugLog('[FT50] Rejected: exact title is ambiguous');
			return null;
		}
		var known = [];
		if (typeof SJRDatabase !== 'undefined') known.push(SJRDatabase.buildIndex());
		if (typeof JCRDatabase !== 'undefined') known.push(JCRDatabase.buildIndex());
		if (typeof ABDCDatabase !== 'undefined') known.push(ABDCDatabase.buildIndex());
		if (typeof QualisCapesDatabase !== 'undefined') known.push(QualisCapesDatabase.buildIndex());
		if (MatchingUtils.hasKnownIdentityConflict(title, item, known, debugLog, 'FT50')) return null;
		return { rank: ' ', match: { method: 'exact-title', matchedTitle: candidates[0], inputTitle: inputTitle } };
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'ft50', name: 'FT50 Journal Ranking', prefKey: 'enableFT50', priority: 106,
	matcher: function(title, debugLog, item) { return ft50Database.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return ft50Database.matchDetailed(title, debugLog, item); }
});
