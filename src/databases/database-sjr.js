/** SCImago Journal Rankings identity-safe matcher. */
/* global sjrRankings, MatchingUtils, DatabaseRegistry */

var SJRDatabase = {
	dataset: null,
	index: null,

	buildIndex: function() {
		if (this.dataset !== sjrRankings || !this.index) {
			this.dataset = sjrRankings;
			this.index = MatchingUtils.buildFlatIndex(sjrRankings);
		}
		return this.index;
	},

	formatResult: function(entry) {
		return entry && entry.quartile ? entry.quartile + ' ' + entry.sjr : null;
	},

	matchDetailed: function(title, debugLog, item) {
		debugLog('[SJR] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveIdentity(this.buildIndex(), title, item, debugLog, 'SJR');
		var rank = resolved && this.formatResult(resolved.entry);
		if (!rank) {
			debugLog('[SJR] Journal NOT found: "' + (title || '') + '"');
			return null;
		}
		debugLog('[SJR] Matched by ' + resolved.match.method + ' -> ' + rank);
		return { rank: rank, match: resolved.match };
	},

	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'sjr', name: 'SCImago Journal Rankings', prefKey: null, priority: 0,
	matcher: function(title, debugLog, item) { return SJRDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return SJRDatabase.matchDetailed(title, debugLog, item); }
});
