/*
 * Publication Rankings - Matching Module
 * String normalization and ranking matching algorithms
 * 
 * Copyright (C) 2025 Ben Stephens
 * Licensed under GNU General Public License v3.0 (GPLv3)
 */

/* global Zotero, coreRankings */

var MatchingUtils = {
	coreIndex: null,
	coreExactIndex: null,
	coreAcronymIndex: null,

	/**
	 * Normalize a string for comparison
	 * Applies multiple transformations to create a canonical form for matching:
	 * - Convert to lowercase
	 * - Replace & with 'and'
	 * - Normalize telecommunications/communications variants
	 * - Remove special characters
	 * - Collapse whitespace
	 * 
	 * @param {string} str - The string to normalize
	 * @returns {string} Normalized string
	 */
	normalizeString: function(str) {
		return str.toLowerCase()
			.replace(/&/g, 'and')
			.replace(/\btelecomm?unications?\b/g, 'communications')
			.replace(/[^\w\s]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	},

	/**
	 * Extract acronym from title (text in parentheses)
	 * 
	 * @param {string} title - The title to extract acronym from
	 * @returns {string|null} Extracted acronym or null if none found
	 * 
	 * @example
	 * extractAcronym("Conference on Security (CCS)") // Returns: "CCS"
	 * extractAcronym("International Conference") // Returns: null
	 */
	extractAcronym: function(title) {
		var match = title.match(/\(([A-Z][A-Z0-9&]+)\)/);
		return match ? match[1] : null;
	},

	/**
	 * Clean conference title by removing noise
	 * Removes common prefixes, years, ordinals, and other patterns that
	 * interfere with matching
	 * 
	 * @param {string} title - The conference title to clean
	 * @returns {string} Cleaned title
	 */
	cleanConferenceTitle: function(title) {
		var cleaned = title
			.replace(/^Proceedings of the\s+/gi, '')
			.replace(/^[A-Z]+\s+\d{4}\s+-\s+/gi, '')
			.replace(/\b\d{4}\b/g, '')
			.replace(/\b\d{1,2}(st|nd|rd|th)\s+(Annual\s+)?/gi, '')
			.replace(/\bAnnual\s+/gi, '')
			.replace(/\s+-\s+[A-Z]+\s+'?\d{2,4}\s*$/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
		return cleaned;
	},

	/**
	 * Lazily build normalized indexes for the CORE rankings database
	 */
	buildCoreIndex: function() {
		if (this.coreIndex) {
			return;
		}

		this.coreIndex = [];
		this.coreExactIndex = Object.create(null);
		this.coreAcronymIndex = Object.create(null);

		for (var title in coreRankings) {
			var normalized = this.normalizeString(title);
			var acronym = this.extractAcronym(title);
			var entry = {
				title: title,
				rank: coreRankings[title],
				normalized: normalized,
				words: normalized.split(' ').filter(function(w) { return w.length > 3; }),
				acronym: acronym
			};

			this.coreIndex.push(entry);
			if (!this.coreExactIndex[normalized]) {
				this.coreExactIndex[normalized] = entry;
			}
			if (acronym) {
				if (!this.coreAcronymIndex[acronym]) {
					this.coreAcronymIndex[acronym] = [];
				}
				this.coreAcronymIndex[acronym].push(entry);
			}
		}
	},

	/**
	 * Match a conference title against CORE rankings database
	 * Uses 5 matching strategies in priority order:
	 * 1. Exact normalized match
	 * 2. Substring match (CORE title appears in Zotero title)
	 * 3. Reverse substring (Zotero title appears in CORE title)
	 * 4. Word overlap (80%+ overlap required)
	 * 5. Acronym match (4+ chars, unique matches only)
	 * 
	 * @param {string} zoteroTitle - The conference title from Zotero item
	 * @param {Function|boolean} [debugParam=false] - Debug function or legacy enable flag
	 * @returns {string|null} CORE ranking or null if no match found
	 */
	matchCoreConference: function(zoteroTitle, debugParam = false) {
		var debugLog = typeof debugParam === 'function' ?
			debugParam :
			debugParam ? function(msg) { Zotero.debug("[MATCH DEBUG] " + msg); } : function() {};
		this.buildCoreIndex();
		
		var cleanedZotero = this.cleanConferenceTitle(zoteroTitle);
		var normalizedZotero = this.normalizeString(cleanedZotero);
		var zoteroAcronym = this.extractAcronym(zoteroTitle);
		
		debugLog(`Matching: "${zoteroTitle}"`);
		debugLog(`  Cleaned: "${cleanedZotero}"`);
		debugLog(`  Normalized: "${normalizedZotero}"`);
		debugLog(`  Acronym: ${zoteroAcronym || "(none)"}`);
		
		// Strategy 1: Exact match (normalized)
		debugLog(`  CORE Strategy 1: Trying exact normalized match`);
		var exactMatch = this.coreExactIndex[normalizedZotero];
		if (exactMatch) {
			debugLog(`  ✓ CORE exact match: "${exactMatch.title}" (${exactMatch.rank})`);
			return exactMatch.rank;
		}
		debugLog(`  No CORE exact match`);
		
		// Strategy 2: Check if Zotero title contains CORE title (substring match)
		debugLog(`  CORE Strategy 2: Trying substring (CORE in Zotero)`);
		for (var i = 0; i < this.coreIndex.length; i++) {
			var candidate = this.coreIndex[i];
			// Only match if CORE title is substantial (>20 chars) to avoid false positives
			if (normalizedZotero.indexOf(candidate.normalized) !== -1 && candidate.normalized.length > 20) {
				debugLog(`  ✓ CORE substring match: "${candidate.title}" (${candidate.rank})`);
				return candidate.rank;
			}
		}
		debugLog(`  No CORE substring match`);
		
		// Strategy 3: Check if CORE title contains Zotero title (reverse substring)
		debugLog(`  CORE Strategy 3: Trying reverse substring (Zotero in CORE)`);
		for (var i = 0; i < this.coreIndex.length; i++) {
			var candidate = this.coreIndex[i];
			if (candidate.normalized.indexOf(normalizedZotero) !== -1 && normalizedZotero.length > 20) {
				debugLog(`  ✓ CORE reverse substring match: "${candidate.title}" (${candidate.rank})`);
				return candidate.rank;
			}
		}
		debugLog(`  No CORE reverse substring match`);
		
		// Strategy 4: Word overlap matching (for titles with extra words like "SIGSAC")
		debugLog(`  CORE Strategy 4: Trying word overlap`);
		var zoteroWords = normalizedZotero.split(' ').filter(function(w) { return w.length > 3; });
		for (var entryIndex = 0; entryIndex < this.coreIndex.length; entryIndex++) {
			var candidate = this.coreIndex[entryIndex];
			var coreWords = candidate.words;
			
			// Count how many significant words overlap
			var matchCount = 0;
			for (var wordIndex = 0; wordIndex < coreWords.length; wordIndex++) {
				if (zoteroWords.indexOf(coreWords[wordIndex]) !== -1) {
					matchCount++;
				}
			}
			
			// If most core words are present (80%+), it's likely a match
			if (coreWords.length >= 4 && matchCount / coreWords.length >= 0.8) {
				debugLog(`  ✓ CORE word overlap match: "${candidate.title}" (${candidate.rank})`);
				debugLog(`    Matched ${matchCount}/${coreWords.length} words (${(matchCount/coreWords.length*100).toFixed(0)}%)`);
				return candidate.rank;
			}
		}
		debugLog(`  No CORE word overlap match`);
		
		// Strategy 5: Acronym matching LAST (as tiebreaker only, since acronyms are ambiguous)
		// Only use if acronym is reasonably unique (4+ characters) or if there's additional evidence
		if (zoteroAcronym && zoteroAcronym.length >= 4) {
			debugLog(`  CORE Strategy 5: Trying acronym match "${zoteroAcronym}" (>= 4 chars, used as tiebreaker)`);
			
			var acronymMatches = this.coreAcronymIndex[zoteroAcronym] || [];
			
			if (acronymMatches.length === 1) {
				// Single match - relatively safe to use
				debugLog(`  ✓ CORE acronym match (unique): "${acronymMatches[0].title}" (${acronymMatches[0].rank})`);
				return acronymMatches[0].rank;
			} else if (acronymMatches.length > 1) {
				debugLog(`  ✗ CORE acronym ambiguous: ${acronymMatches.length} conferences share acronym "${zoteroAcronym}":`);
				for (var match of acronymMatches) {
					debugLog(`    - "${match.title}" (${match.rank})`);
				}
				// Could add tie-breaking logic here (e.g., word overlap with acronym matches)
			} else {
				debugLog(`  No CORE acronym match for "${zoteroAcronym}"`);
			}
		} else if (zoteroAcronym) {
			debugLog(`  CORE Strategy 5: Skipping acronym match "${zoteroAcronym}" (< 4 chars, too ambiguous)`);
		}
		
		return null;
	}
};
