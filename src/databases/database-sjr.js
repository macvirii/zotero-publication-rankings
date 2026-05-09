/**
 * SJR Database Plugin
 * 
 * SCImago Journal Rankings (SJR) database matching strategies.
 * Uses multiple strategies to match journal titles:
 * 1. Exact normalized match
 * 2. Fuzzy match (handles ", ACRONYM" format)
 * 3. Word overlap match (for conference proceedings)
 * 
 * Data source: sjrRankings global object from data.js
 */

/* global Zotero, sjrRankings, MatchingUtils, DatabaseRegistry */

var SJRDatabase = {
	exactIndex: null,
	cleanedIndex: null,
	wordIndex: null,
	issnIndex: null,

	buildIndexes: function() {
		if (this.exactIndex) {
			return;
		}

		this.exactIndex = Object.create(null);
		this.cleanedIndex = Object.create(null);
		this.wordIndex = [];
		this.issnIndex = Object.create(null);

		for (var sjrTitle in sjrRankings) {
			var sjrData = sjrRankings[sjrTitle];
			var lowerTitle = sjrTitle.toLowerCase();
			var cleanedTitle = MatchingUtils.normalizeString(sjrTitle.split(',')[0].trim());
			var normalizedTitle = MatchingUtils.normalizeString(sjrTitle);
			var words = normalizedTitle.split(' ').filter(function(w) { return w.length > 3; });

			if (!this.exactIndex[lowerTitle]) {
				this.exactIndex[lowerTitle] = sjrData;
			}
			if (cleanedTitle.length > 10 && !this.cleanedIndex[cleanedTitle]) {
				this.cleanedIndex[cleanedTitle] = sjrData;
			}
			this.wordIndex.push({ title: sjrTitle, data: sjrData, words: words });

			var issns = sjrData.issns || [];
			for (var i = 0; i < issns.length; i++) {
				if (!this.issnIndex[issns[i]]) {
					this.issnIndex[issns[i]] = sjrData;
				}
			}
		}
	},

	formatResult: function(sjrData) {
		return sjrData.quartile + " " + sjrData.sjr;
	},

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

	/**
	 * Main matching function - tries all strategies in order
	 * 
	 * @param {string} title - Publication title to match
	 * @param {Function} debugLog - Debug logging function
	 * @returns {string|null} Ranking string (e.g., "Q1 0.85") or null if not found
	 */
	match: function(title, debugLog, item) {
		debugLog(`[SJR] Trying SJR database...`);
		this.buildIndexes();
		
		return this.matchIssn(item, debugLog) ||
		       this.matchExact(title, debugLog) ||
		       this.matchFuzzy(title, debugLog) ||
		       this.matchWordOverlap(title, debugLog);
	},

	matchIssn: function(item, debugLog) {
		var issns = this.extractIssns(item);
		for (var i = 0; i < issns.length; i++) {
			var sjrData = this.issnIndex[issns[i]];
			if (sjrData) {
				var result = this.formatResult(sjrData);
				debugLog(`[SJR] ✓ ISSN MATCH: "${issns[i]}" -> ${result}`);
				return result;
			}
		}
		return null;
	},

	/**
	 * Try exact case-insensitive match against SJR database
	 * 
	 * @param {string} title - Normalized publication title
	 * @param {Function} debugLog - Debug logging function
	 * @returns {string|null} Ranking string or null if not found
	 */
	matchExact: function(title, debugLog) {
		var normalizedSearch = title.toLowerCase();
		debugLog(`[SJR] Trying exact match (lowercase): "${normalizedSearch}"`);
		
		var sjrData = this.exactIndex[normalizedSearch];
		if (sjrData) {
			const result = this.formatResult(sjrData);
			debugLog(`[SJR] ✓ EXACT MATCH -> ${result}`);
			return result;
		}
		
		debugLog(`[SJR] No exact match found`);
		return null;
	},

	/**
	 * Try fuzzy match for SJR (handles titles with ", ACRONYM" format)
	 * 
	 * @param {string} title - Normalized publication title
	 * @param {Function} debugLog - Debug logging function
	 * @returns {string|null} Ranking string or null if not found
	 */
	matchFuzzy: function(title, debugLog) {
		var cleanedSearch = MatchingUtils.normalizeString(MatchingUtils.cleanConferenceTitle(title));
		debugLog(`[SJR] Trying fuzzy match: "${cleanedSearch}"`);
		
		var sjrData = this.cleanedIndex[cleanedSearch];
		if (sjrData) {
			const result = this.formatResult(sjrData);
			debugLog(`[SJR] ✓ FUZZY MATCH -> ${result}`);
			return result;
		}
		
		debugLog(`[SJR] No fuzzy match found`);
		return null;
	},

	/**
	 * Try word overlap matching for SJR conference proceedings
	 * Uses strict thresholds to avoid false positives:
	 * - 85% overlap from SJR side
	 * - 80% overlap from search side
	 * - Requires 5+ words
	 * 
	 * @param {string} title - Normalized publication title
	 * @param {Function} debugLog - Debug logging function
	 * @returns {string|null} Ranking string or null if not found
	 */
	matchWordOverlap: function(title, debugLog) {
		var cleanedSearch = MatchingUtils.normalizeString(MatchingUtils.cleanConferenceTitle(title));
		var searchWords = cleanedSearch.split(' ').filter(function(w) { return w.length > 3; });
		
		debugLog(`[SJR] Trying word overlap: cleaned="${cleanedSearch}", words=[${searchWords.join(', ')}]`);
		
		for (var i = 0; i < this.wordIndex.length; i++) {
			var candidate = this.wordIndex[i];
			var sjrWords = candidate.words;
			
			// Count how many significant words overlap
			var matchCount = 0;
			for (var k = 0; k < sjrWords.length; k++) {
				if (searchWords.indexOf(sjrWords[k]) !== -1) {
					matchCount++;
				}
			}
			
			// Use stricter criteria to avoid false positives:
			// 1. Require 85% overlap from SJR side
			// 2. Require 80% overlap from search side (allows "Proceedings of...")
			// 3. Require longer titles (5+ words instead of 4+)
			var sjrOverlap = matchCount / sjrWords.length;
			var searchOverlap = matchCount / searchWords.length;
			
			if (sjrWords.length >= 5 && 
			    sjrOverlap >= 0.85 && 
			    searchOverlap >= 0.80) {
				const result = this.formatResult(candidate.data);
				debugLog(`[SJR] ✓ WORD OVERLAP MATCH: "${candidate.title}"`);
				debugLog(`[SJR]   Matched ${matchCount}/${sjrWords.length} SJR words (${(sjrOverlap*100).toFixed(0)}%), ${matchCount}/${searchWords.length} search words (${(searchOverlap*100).toFixed(0)}%)`);
				debugLog(`[SJR]   Result: ${result}`);
				return result;
			}
		}
		
		debugLog(`[SJR] No word overlap match found (checked ${this.wordIndex.length} entries)`);
		return null;
	}
};

// Register SJR database with the registry
// Always enabled (prefKey = null), highest priority (0)
DatabaseRegistry.register({
	id: 'sjr',
	name: 'SCImago Journal Rankings',
	prefKey: null,  // Always enabled
	priority: 0,    // Checked first
	matcher: function(title, debugLog, item) {
		return SJRDatabase.match(title, debugLog, item);
	}
});
