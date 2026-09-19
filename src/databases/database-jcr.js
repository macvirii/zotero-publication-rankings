/** Journal Citation Reports identity-safe matcher. */
/* global MatchingUtils, DatabaseRegistry, jcrRankings */

var JCRDatabase = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== jcrRankings || !this.index) {
			this.dataset = jcrRankings;
			this.index = MatchingUtils.buildStructuredIndex(jcrRankings);
		}
		return this.index;
	},
	formatResult: function(entry) {
		var quartile = entry && (entry.jcr || entry.quartile);
		if (!quartile) return null;
		return entry.jif !== null && typeof entry.jif !== 'undefined' && entry.jif !== '' ? quartile + ' ' + entry.jif : quartile;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[JCR] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveIdentity(this.buildIndex(), title, item, debugLog, 'JCR');
		var rank = resolved && this.formatResult(resolved.entry);
		if (!rank) return null;
		return { rank: rank, match: resolved.match };
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'jcr', name: 'Journal Citation Reports', prefKey: 'enableJCR', priority: 1,
	matcher: function(title, debugLog, item) { return JCRDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return JCRDatabase.matchDetailed(title, debugLog, item); }
});
