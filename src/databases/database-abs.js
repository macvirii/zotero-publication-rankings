/** CABS Journal Rankings (ABS) conservative title matcher. */
/* global absRankings, MatchingUtils, DatabaseRegistry, SJRDatabase, JCRDatabase, ABDCDatabase, QualisCapesDatabase */

var absDatabase = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== absRankings || !this.index) {
			this.dataset = absRankings;
			this.index = MatchingUtils.buildSimpleTitleIndex(absRankings);
		}
		return this.index;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[ABS] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveSimpleTitle(this.buildIndex(), title, debugLog, 'ABS');
		if (!resolved || !resolved.entry.abs || resolved.entry.abs === 'N/A') return null;
		var known = [];
		if (typeof SJRDatabase !== 'undefined') known.push(SJRDatabase.buildIndex());
		if (typeof JCRDatabase !== 'undefined') known.push(JCRDatabase.buildIndex());
		if (typeof ABDCDatabase !== 'undefined') known.push(ABDCDatabase.buildIndex());
		if (typeof QualisCapesDatabase !== 'undefined') known.push(QualisCapesDatabase.buildIndex());
		if (MatchingUtils.hasKnownIdentityConflict(title, item, known, debugLog, 'ABS')) return null;
		return { rank: resolved.entry.abs, match: resolved.match };
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'abs', name: 'ABS Journal Ranking', prefKey: 'enableABS', priority: 101,
	matcher: function(title, debugLog, item) { return absDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return absDatabase.matchDetailed(title, debugLog, item); }
});
