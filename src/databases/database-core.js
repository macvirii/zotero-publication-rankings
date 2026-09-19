/** CORE Conference Rankings conservative matcher. */
/* global MatchingUtils, DatabaseRegistry */

var COREDatabase = {
	matchDetailed: function(title, debugLog) {
		debugLog('[CORE] Retrieving ranking from database...');
		return MatchingUtils.matchCoreConferenceDetailed(title, debugLog);
	},
	match: function(title, debugLog) {
		var detailed = this.matchDetailed(title, debugLog);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'core', name: 'CORE Conference Rankings', prefKey: 'enableCORE', priority: 100,
	matcher: function(title, debugLog, item) { return COREDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return COREDatabase.matchDetailed(title, debugLog, item); }
});
