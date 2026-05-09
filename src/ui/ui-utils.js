/*
 * Publication Rankings - UI Utilities Module
 * Helper functions for colors, sorting, and display formatting
 * 
 * Copyright (C) 2025 Ben Stephens
 * Licensed under GNU GPL v3
 */

var UIUtils = {
	/**
	 * Get color for a ranking badge
	 * @param {string} ranking - The ranking (e.g., "A*", "Q1", "Nat RU")
	 * @returns {string} CSS color code
	 */
	getRankingColor: function(id, ranking) {
		if (!ranking) return null;

			switch (id) {
			case "sjr":
				// SJR Quartiles (Green to Red gradient)
				if (ranking.startsWith('Q1')) {
					return '#2E7D32'; // Dark green (best)
				};
				if (ranking.startsWith('Q2')) {
					return '#0288D1'; // Blue
				};
				if (ranking.startsWith('Q3')) {
					return '#F57C00'; // Orange
				};
				if (ranking.startsWith('Q4')) {
					return '#D32F2F'; // Red (lowest)
				};
				break;
			case "core":
				// CORE Conference Rankings (same gradient)
				if (ranking === 'A*' || ranking.startsWith('A* ')) {
					return '#2E7D32'; // Dark green (best)
				};
				if (ranking === 'A' || ranking.startsWith('A ') || ranking.startsWith('A[')) {
					return '#0288D1'; // Blue
				};
				if (ranking === 'B' || ranking.startsWith('B ') || ranking.startsWith('B[')) {
					return '#F57C00'; // Orange
				};
				if (ranking === 'C' || ranking.startsWith('C ') || ranking.startsWith('C[')) {
					return '#D32F2F'; // Red
				};

				// Australasian Rankings (same gradient)
				if (ranking.startsWith('Au A')) {
					return '#0288D1'; // Blue
				};
				if (ranking.startsWith('Au B')) {
					return '#F57C00'; // Orange
				};
				if (ranking.startsWith('Au C')) {
					return '#D32F2F'; // Red
				};

				// National Rankings (use purple to distinguish from main tiers)
				if (ranking.startsWith('Nat ')) {
					return '#7B1FA2'; // Purple
				};
				break;
			case "abs":
				// ABS Ranking (Green to Red gradient)
				if (ranking.startsWith('4*')) {
					return '#2E7D32'; // Dark green (best)
				};
				if (ranking.startsWith('4')) {
					return '#92D050'
				};
				if (ranking.startsWith('3')) {
					return '#0288D1'; // Blue
				};
				if (ranking.startsWith('2')) {
					return '#F57C00'; // Orange
				};
				if (ranking.startsWith('1')) {
					return '#D32F2F'; // Red (lowest)
				};
				break;
			case "ft50":
				return '#2E7D32'; // Dark Green
			case "abdc":
				if (ranking === 'A*') return '#2E7D32';
				if (ranking === 'A') return '#0288D1';
				if (ranking === 'B') return '#F57C00';
				if (ranking === 'C') return '#D32F2F';
				break;
			case "qualisCapes":
				if (ranking.startsWith('A1')) return '#2E7D32';
				if (ranking.startsWith('A2')) return '#388E3C';
				if (ranking.startsWith('A3')) return '#0288D1';
				if (ranking.startsWith('A4')) return '#1976D2';
				if (ranking.startsWith('B1') || ranking.startsWith('B2')) return '#F57C00';
				if (ranking.startsWith('B3') || ranking.startsWith('B4')) return '#D32F2F';
				if (ranking.startsWith('C')) return '#757575';
				break;
			case "capesNova":
				if (ranking === 'MB') return '#2E7D32';
				if (ranking === 'B') return '#0288D1';
				if (ranking === 'R') return '#F57C00';
				if (ranking === 'F') return '#D32F2F';
				if (ranking === 'I') return '#757575';
				break;
			case "spell":
				if (ranking === 'Top 10%') return '#2E7D32';
				if (ranking === '10-40%') return '#0288D1';
				if (ranking === '40-70%') return '#F57C00';
				if (ranking === '70-100%') return '#D32F2F';
				break;

			default:
				// Default for other rankings (TBR, Unranked, etc.)
				return '#757575'; // Gray
		}
	},

	/**
	 * Get numeric sort value for a ranking
	 * Higher numbers = better ranking (reverse of typical sorting)
	 * @param {string} ranking - The ranking string
	 * @returns {number} Sort value
	 */
	getRankingSortValue: function (id, ranking) {
		if ((!ranking) || (ranking == 'N/A')) return 0;

			switch (id) {
			case "sjr":
			case "core":
				// CORE A* = highest
				if (ranking === 'A*' || ranking.startsWith('A* ')) return 1000;

				// SJR Q1 / CORE A
				if (ranking.startsWith('Q1')) return 900;
				if (ranking === 'A' || ranking.startsWith('A ') || ranking.startsWith('A[')) return 850;

				// Australasian A
				if (ranking.startsWith('Au A')) return 840;

				// SJR Q2 / CORE B
				if (ranking.startsWith('Q2')) return 700;
				if (ranking === 'B' || ranking.startsWith('B ') || ranking.startsWith('B[')) return 650;

				// Australasian B
				if (ranking.startsWith('Au B')) return 640;

				// SJR Q3 / CORE C
				if (ranking.startsWith('Q3')) return 500;
				if (ranking === 'C' || ranking.startsWith('C ') || ranking.startsWith('C[')) return 450;

				// Australasian C
				if (ranking.startsWith('Au C')) return 440;

				// SJR Q4
				if (ranking.startsWith('Q4')) return 300;

				// National rankings
				if (ranking.startsWith('Nat A')) return 250;
				if (ranking.startsWith('Nat B')) return 200;
				if (ranking.startsWith('Nat C')) return 150;
				if (ranking.startsWith('Nat ')) return 100;

				// ABS Ranking
				if (ranking.startsWith('4*')) return 249;
				if (ranking.startsWith('4')) return 248;
				if (ranking.startsWith('3')) return 247;
				if (ranking.startsWith('2')) return 246;
				if (ranking.startsWith('1')) return 245;

				break;
			case "qualisCapes":
				if (ranking.startsWith('A1')) return 980;
				if (ranking.startsWith('A2')) return 960;
				if (ranking.startsWith('A3')) return 940;
				if (ranking.startsWith('A4')) return 920;
				if (ranking.startsWith('B1')) return 800;
				if (ranking.startsWith('B2')) return 780;
				if (ranking.startsWith('B3')) return 760;
				if (ranking.startsWith('B4')) return 740;
				if (ranking.startsWith('C')) return 100;
				break;
			case "abdc":
				if (ranking === 'A*') return 1000;
				if (ranking === 'A') return 850;
				if (ranking === 'B') return 650;
				if (ranking === 'C') return 450;
				break;
			case "capesNova":
				if (ranking === 'MB') return 980;
				if (ranking === 'B') return 800;
				if (ranking === 'R') return 500;
				if (ranking === 'F') return 300;
				if (ranking === 'I') return 50;
				break;
			case "spell":
				if (ranking === 'Top 10%') return 800;
				if (ranking === '10-40%') return 500;
				if (ranking === '40-70%') return 300;
				if (ranking === '70-100%') return 100;
				break;
			default:
				// Other/Unknown rankings
				return 50;
		}
	},

	/**
	 * Format ranking for display with zero-padded sort prefix
	 * This ensures proper alphabetical sorting in Zotero columns
	 * @param {string} ranking - The ranking string
	 * @returns {string} Formatted ranking with sort prefix
	 */
	formatRankingForDisplay: function(id, ranking) {
		if (!ranking) return '';
		if (!id) {
			id = "sjr";
        }

		// Get sort value and zero-pad to 4 digits
		var sortValue = this.getRankingSortValue(id, ranking);
		var sortPrefix = String(sortValue).padStart(4, '0');
		
		// Return with invisible prefix for sorting
		return sortPrefix + ' ' + ranking;
	},

	/**
	 * Strip sort prefix from displayed ranking
	 * @param {string} displayedRanking - The ranking with sort prefix
	 * @returns {string} Clean ranking without prefix
	 */
	stripSortPrefix: function(displayedRanking) {
		if (!displayedRanking) return '';
		
		// Remove the "0000 " prefix pattern
		return displayedRanking.replace(/^\d{4}\s+/, '');
	},

	/**
	 * Get a human-readable description of a ranking
	 * @param {string} ranking - The ranking
	 * @returns {string} Description
	 */
	getRankingDescription: function(id, ranking) {
		if (!ranking) return 'No ranking found';

			switch (id) {
			case "core":
				// CORE rankings
				if (ranking === 'A*') return 'CORE A* - Flagship conference';
				if (ranking === 'A') return 'CORE A - Excellent conference';
				if (ranking === 'B') return 'CORE B - Good conference';
				if (ranking === 'C') return 'CORE C - Solid conference';
				if (ranking.startsWith('Nat')) return 'CORE ' + ranking + ' - National ranking';
				break;
			case "sjr":
				// SJR quartiles
				if (ranking === 'Q1') return 'SJR Q1 - Top 25% of journals';
				if (ranking === 'Q2') return 'SJR Q2 - Top 50% of journals';
				if (ranking === 'Q3') return 'SJR Q3 - Top 75% of journals';
				if (ranking === 'Q4') return 'SJR Q4 - Bottom 25% of journals';
				break;
			case "abs":
				// ABS Quantriles
				if (ranking === '4*') return 'ABS 4*';
				if (ranking === '4') return 'ABS 4';
				if (ranking === '3') return 'ABS 3';
				if (ranking === '2') return 'ABS 2';
				if (ranking === '1') return 'ABS 1';
				break;
			case "ft50":
				// FT50
				return 'Financial Times 50 journal ranking';
			case "abdc":
				if (ranking === 'A*') return 'ABDC A* - Highest quality journal';
				if (ranking === 'A') return 'ABDC A - High quality journal';
				if (ranking === 'B') return 'ABDC B - Well regarded journal';
				if (ranking === 'C') return 'ABDC C - Recognised journal';
				break;
			case "qualisCapes":
				return 'Qualis CAPES 2021-2024 ' + ranking;
			case "capesNova":
				if (ranking === 'MB') return 'Nova CAPES MB - Muito Bom (8 points)';
				if (ranking === 'B') return 'Nova CAPES B - Bom (4 points)';
				if (ranking === 'R') return 'Nova CAPES R - Regular (2 points)';
				if (ranking === 'F') return 'Nova CAPES F - Fraco (1 point)';
				if (ranking === 'I') return 'Nova CAPES I - Insuficiente (0 points)';
			case "spell":
				if (ranking === 'Top 10%') return 'SPELL - Top 10% by impact';
				if (ranking === '10-40%') return 'SPELL - Between top 10% and 40% by impact';
				if (ranking === '40-70%') return 'SPELL - Between top 40% and 70% by impact';
				if (ranking === '70-100%') return 'SPELL - Between top 70% and 100% by impact';
				break;
		}
		return ranking;
	},

	getDatabaseLabel: function(id) {
		switch (id) {
			case "sjr": return "SJR";
			case "core": return "CORE";
			case "abs": return "ABS";
			case "abdc": return "ABDC";
			case "ft50": return "FT50";
			case "qualisCapes": return "Qualis CAPES";
			case "capesNova": return "Nova CAPES";
			case "spell": return "SPELL";
			default: return id ? id.toUpperCase() : '';
		}
	},

	/**
	 * Format statistics message for bulk operations
	 * @param {Object} stats - Statistics object with counts
	 * @returns {string} Formatted message
	 */
	formatStatsMessage: function(stats) {
		var { total, found, notFound, skipped, notFoundList } = stats;
		
		var message = "Total selected: " + total + " item" + (total !== 1 ? "s" : "") + "\n" +
			"Rankings found: " + found + " item" + (found !== 1 ? "s" : "") + "\n" +
			"Not found: " + notFound + " item" + (notFound !== 1 ? "s" : "") + "\n" +
			"Skipped: " + skipped + " item" + (skipped !== 1 ? "s" : "") + " (no publication title or not regular items)\n\n" +
			"Rankings are displayed in the 'Ranking' column.\n" +
			"Right-click the column headers to show/hide it.";
		
		// Show first 10 not found titles for debugging
		if (notFoundList && notFoundList.length > 0) {
			var displayCount = Math.min(10, notFoundList.length);
			message += "\n\nFirst " + displayCount + " not found title" + (displayCount !== 1 ? "s" : "") + ":";
			for (var j = 0; j < displayCount; j++) {
				message += "\n" + (j + 1) + ". " + notFoundList[j];
			}
		}
		
		return message;
	}
};
