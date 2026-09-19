/*
 * Publication Rankings Plugin for Zotero 7
 * Ranking Actions - User-triggered operations
 * 
 * Copyright (C) 2025 Ben Stephens
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/* global Zotero, RankingEngine, ManualOverrides, ColumnManager, Services, UIUtils */

var RANKING_DATABASE_LABELS = [
	'SJR', 'JCR', 'CORE', 'ABS', 'ABDC', 'FT50', 'Qualis CAPES',
	'Nova CAPES', 'SPELL', 'Manual', 'QUALISCAPES', 'CAPESNOVA', 'MANUAL'
];

/**
 * Build the regex patterns matching every Extra-field ranking line this plugin
 * (or an older version of it) may have written. Shared by dedup and cleanup so
 * the two paths never drift apart.
 *
 * @returns {Array<RegExp>} Patterns matching plugin-written ranking lines
 */
function buildRankingLinePatterns() {
	var escaped = RANKING_DATABASE_LABELS.map(function(label) {
		return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	});
	var titlePattern = `(?:${escaped.join('|')})`;
	return [
		new RegExp(`^Ranking: *.+ *\\(${titlePattern}\\)`, 'i'),  // current: "Ranking: Q1 (SJR)"
		new RegExp(`^Ranking \\(${titlePattern}\\): .+`, 'i'),    // legacy:  "Ranking (SJR): Q1"
		new RegExp(`^.+ ranking \\(${titlePattern}\\)`, 'i'),     // legacy:  "Q1 ranking (SJR)"
		/^Ranking: FT50$/i                                        // label-only FT50 form
	];
}

/**
 * Ranking Actions - Handles all user-triggered operations
 * Bulk check, debug matching, manual overrides
 */
var RankingActions = {
	/** Keyboard-accessible counterpart of the per-badge match tooltip. */
	showMatchDetails: async function(window) {
		var pane = window.ZoteroPane;
		if (!pane) return;
		var items = pane.getSelectedItems();
		if (items.length !== 1 || !items[0].isRegularItem()) {
			await Zotero.alert(window, 'Ranking Match Details', 'Select one publication item to view its ranking match details.');
			return;
		}
		var item = items[0];
		var rankings = RankingEngine.getRankingArray(item);
		ColumnManager.setCachedRanking(item.id, rankings);
		var details = rankings.length ? rankings.map(function(entry) {
			return UIUtils.formatMatchDetails(entry);
		}).join('\n\n') : 'No unambiguous match was found in the enabled ranking sources. Check the publication title and ISSN.';
		await Zotero.alert(window, 'Ranking Match Details', (item.getField('title') || 'Selected item') + '\n\n' + details);
	},

	/**
	 * Update rankings for selected items with progress window
	 * 
	 * @param {Window} window - Zotero window
	 * 
	 * @example
	 * await RankingActions.updateSelectedItems(window);
	 */
	updateSelectedItems: async function(window) {
		// Get ZoteroPane from the window context
		var ZoteroPane = window.ZoteroPane;
		
		if (!ZoteroPane) {
			Zotero.debug("Publication Rankings: ZoteroPane not available in this window");
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		
		if (items.length === 0) {
			await Zotero.alert(window, "No items selected", "Please select some items in your Zotero library first.");
			return;
		}
		
		// Create progress window with proper configuration
		var progressWin = new Zotero.ProgressWindow({ closeOnClick: true });
		progressWin.changeHeadline("Checking Publication Rankings");
		progressWin.show();
		
		var found = 0;
		var notFound = 0;
		var skipped = 0;
		var notFoundList = [];  // Track titles that weren't found
		
		try {
			// Create progress line using ItemProgress
			var progressIcon = 'chrome://zotero/skin/spinner-16px.png';
			var progressLine = new progressWin.ItemProgress(
				progressIcon,
				"Checking " + items.length + " item" + (items.length !== 1 ? "s" : "") + "..."
			);
			
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				
				// Update progress text every 10 items or on last item
				if (i % 10 === 0 || i === items.length - 1) {
					progressLine.setText("Processed " + (i + 1) + " of " + items.length + " items...");
					progressLine.setProgress(Math.round((i + 1) / items.length * 100));
				}
				
				// Skip non-regular items and attachments
				if (!item.isRegularItem()) {
					skipped++;
					continue;
				}
				
				var publicationTitle = RankingEngine.extractPublicationTitle(item);
				if (!publicationTitle) {
					skipped++;
					continue;
				}
				
				// Check if ranking can be found
				var ranking = RankingEngine.getRanking(item);
				if (ranking) {
					found++;
				} else {
					notFound++;
					notFoundList.push(publicationTitle.trim());
				}
			}
			
			// Mark the original line as complete
			progressLine.setText("Processing complete...");
			progressLine.setProgress(100);
			
			// Create a new line for the final results with success icon
			var successIcon = 'chrome://zotero/skin/tick.png';
			var resultsLine = new progressWin.ItemProgress(
				successIcon,
				"Complete! Found: " + found + " | Not found: " + notFound + " | Skipped: " + skipped
			);
			resultsLine.setProgress(100);
			
			// Start auto-close timer AFTER operation completes
			progressWin.startCloseTimer(4000);
			
			// Build detailed message for alert dialog
			var message = "Total selected: " + items.length + " item" + (items.length !== 1 ? "s" : "") + "\n" +
				   "Rankings found: " + found + " item" + (found !== 1 ? "s" : "") + "\n" +
				   "Not found: " + notFound + " item" + (notFound !== 1 ? "s" : "") + "\n" +
				   "Skipped: " + skipped + " item" + (skipped !== 1 ? "s" : "") + " (no publication title or not regular items)\n\n" +
				   "Rankings are displayed in the 'Ranking' column.\n" +
				   "Right-click the column headers to show/hide it.";
			
			// Show first 10 not found titles for debugging
			if (notFoundList.length > 0) {
				var displayCount = Math.min(10, notFoundList.length);
				message += "\n\nFirst " + displayCount + " not found title" + (displayCount !== 1 ? "s" : "") + ":";
				for (var j = 0; j < displayCount; j++) {
					message += "\n" + (j + 1) + ". " + notFoundList[j];
				}
			}
			
			await Zotero.alert(window, "Rankings Check Complete", message);
		} catch (e) {
			Zotero.debug("Publication Rankings: Error in updateSelectedItems: " + e);
			progressWin.close();
			throw e;
		}
	},
	
	/**
	 * Debug matching for selected items - shows detailed matching algorithm output
	 * 
	 * @param {Window} window - Zotero window
	 * 
	 * @example
	 * await RankingActions.debugSelectedItems(window);
	 */
	debugSelectedItems: async function(window) {
		var ZoteroPane = window.ZoteroPane;
		
		if (!ZoteroPane) {
			Zotero.debug("Publication Rankings: ZoteroPane not available");
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		
		if (items.length === 0) {
			await Zotero.alert(window, "No items selected", "Please select one or more items to debug ranking matches.");
			return;
		}
		
		await Zotero.alert(
			window,
			"Debug Matching",
			`Debug matching will be logged for ${items.length} item${items.length !== 1 ? 's' : ''}.\n\n` +
			`Open Help → Debug Output Logging → View Output to see detailed matching information.\n\n` +
			`Look for lines starting with [MATCH DEBUG].`
		);
		
		// Process each item with debug logging enabled
		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			
			if (!item.isRegularItem()) {
				continue;
			}
			
			// Call with debug enabled - this will log detailed matching info
			RankingEngine.getRanking(item, true);
		}
		
		Zotero.debug("Publication Rankings: Debug matching complete");
	},
	
	/**
	 * Set manual ranking for selected items
	 * 
	 * @param {Window} window - Zotero window
	 * 
	 * @example
	 * await RankingActions.setManualRankingDialog(window);
	 */
	setManualRankingDialog: async function(window) {
		var ZoteroPane = window.ZoteroPane;
		
		if (!ZoteroPane) {
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		
		if (items.length === 0) {
			await Zotero.alert(window, "No items selected", "Please select one or more items to set manual ranking.");
			return;
		}
		
		// Get publication titles (ensure they're all the same for batch operations)
		var publicationTitles = new Set();
		for (var item of items) {
			if (!item.isRegularItem()) continue;
			
			var pubTitle = RankingEngine.extractPublicationTitle(item);
			if (pubTitle) {
				publicationTitles.add(pubTitle.trim());
			}
		}
		
		if (publicationTitles.size === 0) {
			await Zotero.alert(window, "No publication titles", "Selected items don't have publication titles.");
			return;
		}
		
		if (publicationTitles.size > 1) {
			await Zotero.alert(
				window,
				"Multiple publications",
				`Selected items have ${publicationTitles.size} different publication titles.\n\nPlease select items from the same publication to set a manual ranking.`
			);
			return;
		}
		
		var publicationTitle = Array.from(publicationTitles)[0];
		
		// Check if there's already a manual override
		var existingOverride = ManualOverrides.get(publicationTitle);
		var defaultValue = existingOverride || '';
		
		// Zotero exposes Services in the bootstrap scope. Manual Services.jsm imports
		// are not supported on newer Mozilla runtimes used by Zotero 8+.
		if (typeof Services === 'undefined') {
			throw new Error('Services global is not available');
		}
		
		var input = { value: defaultValue };
		var result = Services.prompt.prompt(
			window,
			"Set Manual Ranking",
			`Set ranking for:\n"${publicationTitle}"\n\nExamples: A*, A, B, C, Q1, Q2, Q3, Q4, Au A, Nat A\n\nRanking:`,
			input,
			null,
			{}
		);
		
		if (result && input.value) {
			var ranking = input.value.trim();
			await ManualOverrides.set(publicationTitle, ranking);

			// Overrides are keyed by publication title, so any item sharing this
			// title is affected - not just the selection. Clear the whole cache.
			ColumnManager.clearAllCache();

			Zotero.Notifier.trigger('refresh', 'itemtree', []);
			
			await Zotero.alert(
				window,
				"Manual Ranking Set",
				`Set ranking for "${publicationTitle}":\n${ranking}\n\nThe ranking column will update automatically.`
			);
		}
	},
	
	/**
	 * Clear manual ranking for selected items
	 * 
	 * @param {Window} window - Zotero window
	 * 
	 * @example
	 * await RankingActions.clearManualRankingForSelected(window);
	 */
	clearManualRankingForSelected: async function(window) {
		var ZoteroPane = window.ZoteroPane;
		
		if (!ZoteroPane) {
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		
		if (items.length === 0) {
			await Zotero.alert(window, "No items selected", "Please select one or more items to clear manual ranking.");
			return;
		}
		
		var cleared = 0;
		var publicationTitles = new Set();
		
		for (var item of items) {
			if (!item.isRegularItem()) continue;
			
			var pubTitle = RankingEngine.extractPublicationTitle(item);
			if (pubTitle) {
				publicationTitles.add(pubTitle.trim());
			}
		}
		
		for (var title of publicationTitles) {
			if (ManualOverrides.get(title)) {
				await ManualOverrides.remove(title);
				cleared++;
			}
		}
		
		if (cleared > 0) {
			// Overrides are keyed by publication title, so any item sharing these
			// titles is affected - not just the selection. Clear the whole cache.
			ColumnManager.clearAllCache();

			Zotero.Notifier.trigger('refresh', 'itemtree', []);
			
			await Zotero.alert(
				window,
				"Manual Rankings Cleared",
				`Cleared ${cleared} manual ranking${cleared !== 1 ? 's' : ''}.\n\nRankings will revert to automatic matching.`
			);
		} else {
			await Zotero.alert(
				window,
				"No Manual Rankings",
				"None of the selected items have manual ranking overrides."
			);
		}
	},

	/**
	 * Write rankings to Extra field for selected items
	 * Uses batch processing with progress window for efficiency
	 * Optimized to use cached rankings and batch database saves
	 * 
	 * @param {Window} window - Zotero window
	 * 
	 * @example
	 * await RankingActions.writeRankingsToExtra(window);
	 */
	writeRankingsToExtra: async function(window) {
		var ZoteroPane = window.ZoteroPane;
		
		if (!ZoteroPane) {
			Zotero.debug("Publication Rankings: ZoteroPane not available in this window");
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		
		if (items.length === 0) {
			await Zotero.alert(window, "No items selected", "Please select some items in your Zotero library first.");
			return;
		}
		
		// Create progress window
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline("Writing Rankings to Extra Field");
		progressWin.show();
		
		var progressLine = new progressWin.ItemProgress(
			'chrome://zotero/skin/spinner-16px.png',
			`Processing ${items.length} item${items.length !== 1 ? 's' : ''}...`
		);
		
		try {
			var updated = 0;
			var skipped = 0;
			var itemsToSave = [];
			
			// First pass: Update all Extra fields without saving
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				
				// Update progress
				progressLine.setText(`Processing ${i + 1} of ${items.length}...`);
				progressLine.setProgress((i / items.length) * 100);
				
				if (!item.isRegularItem()) {
					skipped++;
					continue;
				}
				
				// Try to get from cache first (much faster!)
				// Cache now stores array of ranking objects
				var rankingData = ColumnManager.getCachedRanking(item.id);
				
				// If cache miss, fall back to full matching
				if (!rankingData || rankingData.length === 0) {
					rankingData = RankingEngine.getRankingArray(item, false);
					
					if (!rankingData || rankingData.length === 0) {
						skipped++;
						continue;
					}
				}
				
				// Convert structured ranking objects to Extra field format
				var extraData = [];
				for (var j = 0; j < rankingData.length; j++) {
					var entry = rankingData[j];
					extraData.push({
						database: UIUtils.getDatabaseLabel(entry.id),
						ranking: entry.rank == null ? '' : String(entry.rank).trim()
					});
				}
				
				if (extraData.length > 0) {
					// Update Extra field WITHOUT saving yet
					var wasUpdated = this.updateRankingsInExtra(item, extraData);
					if (wasUpdated) {
						itemsToSave.push(item);
						updated++;
					}
				} else {
					skipped++;
				}
			}
			
			// Second pass: Batch save all items at once (MUCH faster!)
			if (itemsToSave.length > 0) {
				progressLine.setText(`Saving ${itemsToSave.length} items...`);
				await Zotero.DB.executeTransaction(async function() {
					for (var k = 0; k < itemsToSave.length; k++) {
						await itemsToSave[k].save();
					}
				});
			}
			
			// Mark complete
			progressLine.setText("Processing complete...");
			progressLine.setProgress(100);
			
			// Create success line
			var successIcon = 'chrome://zotero/skin/tick.png';
			var resultsLine = new progressWin.ItemProgress(
				successIcon,
				`Complete! Updated: ${updated} | Skipped: ${skipped}`
			);
			resultsLine.setProgress(100);
			
			// Start auto-close timer
			progressWin.startCloseTimer(4000);
			
			await Zotero.alert(
				window,
				"Rankings Written to Extra Field",
				`Total selected: ${items.length} item${items.length !== 1 ? 's' : ''}\n` +
				`Updated: ${updated} item${updated !== 1 ? 's' : ''}\n` +
				`Skipped: ${skipped} item${skipped !== 1 ? 's' : ''} (no rankings found or not regular items)\n\n` +
				`Rankings have been written to the Extra field.`
			);
		} catch (e) {
			Zotero.debug("Publication Rankings: Error in writeRankingsToExtra: " + e);
			progressWin.close();
			throw e;
		}
	},

	/**
	 * Update rankings in Extra field (without saving to database)
	 * Returns true if Extra field was modified
	 * 
	 * @param {Object} item - Zotero item
	 * @param {Array} rankingData - Array of {database, ranking} objects
	 * @returns {boolean} True if Extra field was modified
	 */
	updateRankingsInExtra: function(item, rankingData) {
		try {
			var extra = item.getField('extra');
			if (!extra) {
				extra = '';
			}
			
			var extras = extra.split('\n');
			
			// Patterns to match existing ranking entries (multiple formats for compatibility)
			var patterns = buildRankingLinePatterns();
			
			// Remove old ranking lines that match any pattern
			var filteredExtras = extras.filter(function(line) {
				var match = false;
				for (var k = 0; k < patterns.length; k++) {
					if (patterns[k].test(line)) {
						match = true;
						break;
					}
				}
				return !match;
			});
			
			// Add new ranking entries (no date stamp - rankings are relatively stable)
			for (var i = 0; i < rankingData.length; i++) {
				var data = rankingData[i];
				var rank = data.ranking == null ? '' : String(data.ranking).trim();
				var newEntry = rank ?
					`Ranking: ${rank} (${data.database})` :
					`Ranking: ${data.database}`;
				
				// Insert before BBT citation key if it exists
				var bbtCitekeyPattern = /^Citation Key: \S+/i;
				var inserted = false;
				
				for (var j = 0; j < filteredExtras.length; j++) {
					if (bbtCitekeyPattern.test(filteredExtras[j])) {
						filteredExtras.splice(j, 0, newEntry);
						inserted = true;
						break;
					}
				}
				
				// If no BBT citation key found, add at the end
				if (!inserted) {
					filteredExtras.push(newEntry);
				}
			}
			
			// Check if anything changed
			var newExtra = filteredExtras.join('\n');
			if (newExtra === extra) {
				return false; // No changes needed
			}
			
			// Update field (but don't save yet)
			item.setField('extra', newExtra);
			return true; // Extra field was modified
		} catch (e) {
			Zotero.logError('Publication Rankings: Error updating rankings in Extra field: ' + e);
			return false;
		}
	},

	/**
	 * Remove all ranking entries from Extra fields across the entire library
	 * Called during plugin uninstall/disable
	 * 
	 * @example
	 * await RankingActions.cleanupAllRankingsFromExtra();
	 */
	cleanupAllRankingsFromExtra: async function() {
		try {
			Zotero.debug('Publication Rankings: Starting cleanup of all ranking entries from Extra fields');
			
			// Get all items in the library
			var allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID, true);
			
			var cleaned = 0;
			var processed = 0;
			var itemsToSave = [];
			
			// Match only ranking entries written by this plugin (same patterns as dedup)
			var patterns = buildRankingLinePatterns();

			for (var i = 0; i < allItems.length; i++) {
				var item = allItems[i];

				if (!item.isRegularItem()) {
					continue;
				}

				var extra = item.getField('extra');
				if (!extra) {
					continue;
				}

				var extras = extra.split('\n');
				var filteredExtras = extras.filter(function(line) {
					return !patterns.some(function(pattern) {
						return pattern.test(line);
					});
				});
				
				// Only save if something was removed
				if (filteredExtras.length !== extras.length) {
					var newExtra = filteredExtras.join('\n');
					item.setField('extra', newExtra);
					itemsToSave.push(item);
					cleaned++;
					
					Zotero.debug(`Publication Rankings: Cleaned item ${item.id}: removed ${extras.length - filteredExtras.length} ranking entries`);
				}
				
				processed++;
				
				// Log progress every 100 items
				if (processed % 100 === 0) {
					Zotero.debug(`Publication Rankings: Cleanup progress: ${processed}/${allItems.length} items processed, ${cleaned} cleaned`);
				}
			}

			if (itemsToSave.length > 0) {
				await Zotero.DB.executeTransaction(async function() {
					for (var j = 0; j < itemsToSave.length; j++) {
						await itemsToSave[j].save();
					}
				});
			}
			
			Zotero.debug(`Publication Rankings: Cleanup complete - Processed ${processed} items, cleaned ${cleaned} items`);
			return { processed, cleaned };
		} catch (e) {
			Zotero.logError('Publication Rankings: Error during cleanup: ' + e);
			return { processed: 0, cleaned: 0 };
		}
	}
};
