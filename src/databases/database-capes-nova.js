/** Nova Classificacao CAPES local source aggregation. */
/* global MatchingUtils, DatabaseRegistry, scieloRankings, ABDCDatabase, absDatabase, JCRDatabase, SJRDatabase, SPELLDatabase */

var CapesNovaDatabase = {
	scieloDataset: null,
	scieloIndex: null,
	gradeValue: { I: 0, F: 1, R: 2, B: 3, MB: 4 },

	getScieloIndex: function() {
		if (this.scieloDataset !== scieloRankings || !this.scieloIndex) {
			this.scieloDataset = scieloRankings;
			this.scieloIndex = MatchingUtils.buildStructuredIndex(scieloRankings);
		}
		return this.scieloIndex;
	},

	gradeFromQuartile: function(value) {
		return { Q1: 'MB', Q2: 'B', Q3: 'R', Q4: 'F' }[value] || null;
	},
	gradeFromAbdc: function(value) {
		return { 'A*': 'MB', A: 'MB', B: 'B', C: 'R' }[value] || null;
	},
	gradeFromAbs: function(value) {
		if (value === '4*' || value === '4' || value === '3' || value === '2') return 'MB';
		return value === '1' ? 'B' : null;
	},
	gradeFromSpell: function(value, inScielo) {
		if (value === 'Top 10%') return inScielo ? 'B' : null;
		if (value === '10-40%') return 'R';
		if (value === '40-70%') return 'F';
		return null;
	},

	hasCrossSourceConflict: function(sources, debugLog) {
		var groups = [];
		for (var i = 0; i < sources.length; i++) {
			var evidence = sources[i].match && sources[i].match.evidence;
			var issns = evidence && evidence.candidateIssns || [];
			if (issns.length) groups.push({ id: sources[i].id, issns: issns });
		}
		if (groups.length < 2) return false;
		var connected = [0];
		for (var cursor = 0; cursor < connected.length; cursor++) {
			for (var candidate = 0; candidate < groups.length; candidate++) {
				if (connected.indexOf(candidate) === -1 &&
					MatchingUtils.intersects(groups[connected[cursor]].issns, groups[candidate].issns)) {
					connected.push(candidate);
				}
			}
		}
		if (connected.length !== groups.length) {
			debugLog('[Nova CAPES] Rejected: matched sources identify incompatible records');
			return true;
		}
		return false;
	},

	matchDetailed: function(title, debugLog, item) {
		debugLog('[Nova CAPES] Calculating local classification...');
		var sources = [];
		var scielo = MatchingUtils.resolveIdentity(this.getScieloIndex(), title, item, debugLog, 'SciELO');
		if (scielo && scielo.entry.scielo) sources.push({ id: 'scielo', rank: 'Member', match: scielo.match });

		var matchers = [
			{ id: 'abdc', run: function() { return ABDCDatabase.matchDetailed(title, debugLog, item); } },
			{ id: 'abs', run: function() { return absDatabase.matchDetailed(title, debugLog, item); } },
			{ id: 'jcr', run: function() { return JCRDatabase.matchDetailed(title, debugLog, item); } },
			{ id: 'sjr', run: function() { return SJRDatabase.matchDetailed(title, debugLog, item); } },
			{ id: 'spell', run: function() { return SPELLDatabase.matchDetailed(title, debugLog, item); } }
		];
		for (var i = 0; i < matchers.length; i++) {
			var result = matchers[i].run();
			if (result) sources.push({ id: matchers[i].id, rank: result.rank, match: result.match });
		}
		if (!sources.length || this.hasCrossSourceConflict(sources, debugLog)) return null;

		var bestGrade = null;
		var winningRule = null;
		var inScielo = sources.some(function(source) { return source.id === 'scielo'; });
		for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
			var source = sources[sourceIndex];
			var candidate = null;
			if (source.id === 'abdc') candidate = this.gradeFromAbdc(source.rank);
			else if (source.id === 'abs') candidate = this.gradeFromAbs(source.rank);
			else if (source.id === 'jcr' || source.id === 'sjr') candidate = this.gradeFromQuartile(source.rank.split(/\s+/)[0]);
			else if (source.id === 'spell') candidate = this.gradeFromSpell(source.rank, inScielo);
			if (candidate && (!bestGrade || this.gradeValue[candidate] > this.gradeValue[bestGrade])) {
				bestGrade = candidate;
				winningRule = source.id + ' ' + source.rank + ' -> ' + candidate;
			}
		}

		var baseGrade = bestGrade;
		var scieloAdjustment = null;
		if (inScielo && bestGrade === 'F') {
			bestGrade = 'R';
			scieloAdjustment = { from: 'F', to: 'R' };
		} else if (inScielo && bestGrade === 'R') {
			bestGrade = 'B';
			scieloAdjustment = { from: 'R', to: 'B' };
		}
		if (!bestGrade) {
			bestGrade = 'I';
			baseGrade = null;
			winningRule = 'matched source with no qualifying rule -> I';
		}

		var preferred = sources.filter(function(source) { return source.match && source.match.matchedIssn; })[0] || sources[0];
		var match = {
			method: 'source-aggregation',
			matchedTitle: preferred.match.matchedTitle,
			inputTitle: MatchingUtils.toNfc(title || '').trim(),
			evidence: { winningRule: winningRule, baseGrade: baseGrade, scieloAdjustment: scieloAdjustment },
			sources: sources
		};
		if (preferred.match.matchedIssn) match.matchedIssn = preferred.match.matchedIssn;
		debugLog('[Nova CAPES] Classification: ' + bestGrade + ' (' + winningRule + ')');
		return { rank: bestGrade, match: match };
	},

	match: function(title, debugLog, item) {
		var detailed = this.matchDetailed(title, debugLog, item);
		return detailed ? detailed.rank : null;
	}
};

DatabaseRegistry.register({
	id: 'capesNova', name: 'Nova Classificacao CAPES', prefKey: 'enableCapesNova', priority: 104,
	matcher: function(title, debugLog, item) { return CapesNovaDatabase.match(title, debugLog, item); },
	detailedMatcher: function(title, debugLog, item) { return CapesNovaDatabase.matchDetailed(title, debugLog, item); }
});
