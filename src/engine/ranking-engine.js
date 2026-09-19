/*
 * Publication Rankings Plugin for Zotero 7
 * Ranking matching engine - Pure logic with no UI dependencies
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

/* global Zotero, DatabaseRegistry, ManualOverrides, UIUtils, MatchingUtils, rankingDatasetMetadata */

var RankingEngine = {
	getDatasetMetadata: function(id) {
		if (typeof rankingDatasetMetadata === 'undefined' || !rankingDatasetMetadata) return null;
		var metadata = rankingDatasetMetadata[id];
		if (!metadata || typeof metadata.label !== 'string' || !metadata.label.trim() ||
			typeof metadata.edition !== 'string' || !metadata.edition.trim()) return null;
		var verified = { label: metadata.label, edition: metadata.edition };
		if (typeof metadata.source === 'string' && metadata.source.trim()) verified.source = metadata.source;
		return verified;
	},

	attachMetadata: function(id, match) {
		if (!match) return match;
		var metadata = this.getDatasetMetadata(id);
		if (metadata) match.dataset = metadata;
		if (Array.isArray(match.sources)) {
			for (var i = 0; i < match.sources.length; i++) {
				var source = match.sources[i];
				if (source && source.match) this.attachMetadata(source.id, source.match);
			}
		}
		return match;
	},

	getRanking: function(item, enableDebug) {
		var resolved = this.getRankingArray(item, enableDebug);
		if (resolved.length === 1 && resolved[0].id === 'Manual') return resolved[0].rank;
		var values = [];
		for (var i = 0; i < resolved.length; i++) {
			var entry = resolved[i];
			var label = UIUtils.getDatabaseLabel(entry.id);
			values.push(entry.rank.trim() ? label + ': ' + entry.rank : label);
		}
		return values.join(' ');
	},

	getRankingArray: function(item, enableDebug) {
		try {
			var matches = [];
			if (!item || !item.isRegularItem()) return matches;
			var publicationTitle = this.extractPublicationTitle(item) || '';
			var title = publicationTitle.trim();
			var inputIssns = MatchingUtils.extractIssns(item);
			if (!title && !inputIssns.length) return matches;
			var debugLog = function(message) {
				if (enableDebug) Zotero.debug('[MATCH DEBUG] ' + message);
			};

			if (title) {
				var manualOverride = ManualOverrides.get(publicationTitle);
				if (manualOverride) {
					matches.push({
						id: 'Manual', rank: manualOverride, color: '#757575',
						match: { method: 'manual-override', matchedTitle: publicationTitle, inputTitle: publicationTitle }
					});
					return matches;
				}
			}

			var databases = DatabaseRegistry.getEnabledDatabases();
			for (var i = 0; i < databases.length; i++) {
				var db = databases[i];
				var detailed = db.detailedMatcher ? db.detailedMatcher(title, debugLog, item) : null;
				if (!db.detailedMatcher) {
					var legacyRank = db.matcher(title, debugLog, item);
					if (legacyRank) detailed = {
						rank: legacyRank,
						match: null
					};
				}
				if (!detailed || detailed.rank === null || typeof detailed.rank === 'undefined') continue;
				this.attachMetadata(db.id, detailed.match);
				matches.push({
					id: db.id,
					rank: detailed.rank,
					color: UIUtils.getRankingColor(db.id, detailed.rank),
					match: detailed.match
				});
			}
			return matches;
		} catch (error) {
			Zotero.logError('RankingEngine: Error getting ranking: ' + error);
			return [];
		}
	},

	extractPublicationTitle: function(item) {
		if (!item || !item.isRegularItem()) return null;
		var fields = ['publicationTitle', 'proceedingsTitle', 'conferenceName'];
		for (var i = 0; i < fields.length; i++) {
			var value = item.getField(fields[i]);
			if (value && value.trim()) return value;
		}
		return null;
	}
};
