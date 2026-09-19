/** Australian Business Deans Council identity-safe matcher. */
/* global MatchingUtils, DatabaseRegistry, abdcRankings */

var ABDCDatabase = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== abdcRankings || !this.index) {
			this.dataset = abdcRankings;
			this.index = MatchingUtils.buildStructuredIndex(abdcRankings);
		}
		return this.index;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[ABDC] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveIdentity(this.buildIndex(), title, item, debugLog, 'ABDC');
		var rank = resolved && resolved.entry.abdc;
		return rank ? { rank: rank, match: resolved.match } : null;
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'abdc', name: 'ABDC Journal Quality List', prefKey: 'enableABDC', priority: 102,
	matcher: function(title, debugLog, item) { return ABDCDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return ABDCDatabase.matchDetailed(title, debugLog, item); }
});
