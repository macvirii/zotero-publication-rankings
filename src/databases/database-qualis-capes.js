/** Qualis CAPES 2021-2024 identity-safe matcher. */
/* global MatchingUtils, DatabaseRegistry, qualisCapes2021Rankings */

var QualisCapesDatabase = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== qualisCapes2021Rankings || !this.index) {
			this.dataset = qualisCapes2021Rankings;
			this.index = MatchingUtils.buildStructuredIndex(qualisCapes2021Rankings);
		}
		return this.index;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[Qualis CAPES] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveIdentity(this.buildIndex(), title, item, debugLog, 'Qualis CAPES');
		var rank = resolved && resolved.entry.qualis;
		return rank ? { rank: rank, match: resolved.match } : null;
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'qualisCapes', name: 'Qualis CAPES 2021-2024', prefKey: 'enableQualisCapes', priority: 103,
	matcher: function(title, debugLog, item) { return QualisCapesDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return QualisCapesDatabase.matchDetailed(title, debugLog, item); }
});
