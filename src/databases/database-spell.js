/** SPELL impact percentile conservative matcher. */
/* global MatchingUtils, DatabaseRegistry, spellRankings, SJRDatabase, JCRDatabase, ABDCDatabase, QualisCapesDatabase */

var SPELLDatabase = {
	dataset: null,
	index: null,
	buildIndex: function() {
		if (this.dataset !== spellRankings || !this.index) {
			this.dataset = spellRankings;
			this.index = MatchingUtils.buildStructuredIndex(spellRankings);
		}
		return this.index;
	},
	displayClass: function(value) {
		return { top10: 'Top 10%', next30: '10-40%', next30_2: '40-70%', bottom30: '70-100%' }[value] || value;
	},
	matchDetailed: function(title, debugLog, item) {
		debugLog('[SPELL] Retrieving ranking from database...');
		var resolved = MatchingUtils.resolveIdentity(this.buildIndex(), title, item, debugLog, 'SPELL');
		if (!resolved || !resolved.entry.spell) return null;
		var known = [];
		if (typeof SJRDatabase !== 'undefined') known.push(SJRDatabase.buildIndex());
		if (typeof JCRDatabase !== 'undefined') known.push(JCRDatabase.buildIndex());
		if (typeof ABDCDatabase !== 'undefined') known.push(ABDCDatabase.buildIndex());
		if (typeof QualisCapesDatabase !== 'undefined') known.push(QualisCapesDatabase.buildIndex());
		if (MatchingUtils.hasKnownIdentityConflict(title, item, known, debugLog, 'SPELL')) return null;
		return { rank: this.displayClass(resolved.entry.spell), match: resolved.match };
	},
	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'spell', name: 'SPELL Impact Ranking', prefKey: 'enableSPELL', priority: 105,
	matcher: function(title, debugLog, item) { return SPELLDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return SPELLDatabase.matchDetailed(title, debugLog, item); }
});
