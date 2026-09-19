/*
 * Publication Rankings - shared identity-safe matching helpers
 * Copyright (C) 2025 Ben Stephens
 * Licensed under GNU General Public License v3.0 (GPLv3)
 */
/* global coreRankings */

var MatchingUtils = {
	coreDataset: null,
	coreExactIndex: null,
	coreTitleIndex: null,
	coreAcronymIndex: null,

	toNfc: function(value) {
		var text = value === null || typeof value === 'undefined' ? '' : String(value);
		return typeof text.normalize === 'function' ? text.normalize('NFC') : text;
	},

	normalizeExactTitle: function(value) {
		return this.toNfc(value).toLowerCase().replace(/\s+/gu, ' ').trim();
	},

	normalizeString: function(value) {
		return this.toNfc(value).toLowerCase()
			.replace(/&/gu, ' and ')
			.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
			.replace(/\s+/gu, ' ')
			.trim();
	},

	addIndexValue: function(index, key, value) {
		if (!key) return;
		if (!index[key]) index[key] = [];
		if (index[key].indexOf(value) === -1) index[key].push(value);
	},

	uniqueValues: function(values) {
		var unique = [];
		for (var i = 0; i < values.length; i++) {
			if (values[i] && unique.indexOf(values[i]) === -1) unique.push(values[i]);
		}
		return unique;
	},

	normalizeIssn: function(value) {
		var cleaned = String(value || '').replace(/[-\s]/g, '').toUpperCase();
		if (!/^[0-9]{7}[0-9X]$/.test(cleaned)) return '';
		var sum = 0;
		for (var i = 0; i < 7; i++) sum += Number(cleaned.charAt(i)) * (8 - i);
		var checkValue = (11 - (sum % 11)) % 11;
		var expected = checkValue === 10 ? 'X' : String(checkValue);
		return cleaned.charAt(7) === expected ? cleaned : '';
	},

	extractIssnsFromValue: function(value) {
		var text = String(value || '');
		var pattern = /(^|[^\p{L}\p{N}])([0-9]{4}[- ]?[0-9]{3}[0-9Xx])(?=$|[^\p{L}\p{N}])/gu;
		var result = [];
		var match;
		while ((match = pattern.exec(text)) !== null) {
			var issn = this.normalizeIssn(match[2]);
			if (issn && result.indexOf(issn) === -1) result.push(issn);
		}
		return result;
	},

	extractIssns: function(item) {
		if (!item || typeof item.getField !== 'function') return [];
		return this.extractIssnsFromValue(item.getField('ISSN') || '');
	},

	entryIssns: function(entry) {
		var values = entry && Array.isArray(entry.issns) ? entry.issns : [];
		var result = [];
		for (var i = 0; i < values.length; i++) {
			var issn = this.normalizeIssn(values[i]);
			if (issn && result.indexOf(issn) === -1) result.push(issn);
		}
		return result;
	},

	entryTitles: function(entry, fallbackTitle) {
		var values = fallbackTitle ? [fallbackTitle] : [];
		if (entry && entry.title) values.push(entry.title);
		if (entry && Array.isArray(entry.titles)) values = values.concat(entry.titles);
		for (var i = 0; i < values.length; i++) values[i] = this.toNfc(values[i]);
		return this.uniqueValues(values);
	},

	newIdentityIndex: function() {
		return { records: [], exactTitles: Object.create(null), normalizedTitles: Object.create(null), byIssn: Object.create(null) };
	},

	addRecord: function(index, title, entry, issns) {
		var record = {
			id: index.records.length,
			title: this.toNfc(title || ''),
			titles: this.entryTitles(entry, title),
			entry: entry || {},
			issns: this.uniqueValues(issns || [])
		};
		index.records.push(record);
		for (var i = 0; i < record.titles.length; i++) {
			this.addIndexValue(index.exactTitles, this.normalizeExactTitle(record.titles[i]), record);
			this.addIndexValue(index.normalizedTitles, this.normalizeString(record.titles[i]), record);
		}
		for (var j = 0; j < record.issns.length; j++) this.addIndexValue(index.byIssn, record.issns[j], record);
		return record;
	},

	mergeRecords: function(keep, remove) {
		keep = this.canonicalRecord(keep);
		remove = this.canonicalRecord(remove);
		if (keep === remove) return keep;
		remove._mergedInto = keep;
		keep.titles = this.uniqueValues(keep.titles.concat(remove.titles));
		keep.issns = this.uniqueValues(keep.issns.concat(remove.issns));
		return keep;
	},

	ratingSignature: function(entry) {
		var fields = ['sjr', 'quartile', 'jcr', 'jif', 'abdc', 'qualis', 'spell', 'abs', 'scielo', 'rank'];
		var signature = {};
		for (var i = 0; i < fields.length; i++) {
			if (entry && typeof entry[fields[i]] !== 'undefined') signature[fields[i]] = entry[fields[i]];
		}
		return JSON.stringify(signature);
	},

	canMergeRecords: function(left, right) {
		var leftSource = left.entry && left.entry.sourceId;
		var rightSource = right.entry && right.entry.sourceId;
		if ((leftSource || rightSource) && leftSource !== rightSource) return false;
		return this.ratingSignature(left.entry) === this.ratingSignature(right.entry);
	},

	canonicalRecord: function(record) {
		while (record && record._mergedInto) record = record._mergedInto;
		return record;
	},

	canonicalizeIndex: function(index) {
		var maps = [index.exactTitles, index.normalizedTitles, index.byIssn];
		for (var m = 0; m < maps.length; m++) {
			for (var key in maps[m]) {
				var canonical = [];
				for (var i = 0; i < maps[m][key].length; i++) {
					var record = this.canonicalRecord(maps[m][key][i]);
					if (record && canonical.indexOf(record) === -1) canonical.push(record);
				}
				maps[m][key] = canonical;
			}
		}
	},

	buildStructuredIndex: function(dataset) {
		var index = this.newIdentityIndex();
		var byTitle = dataset && dataset.byTitle || {};
		for (var title in byTitle) {
			var entries = Array.isArray(byTitle[title]) ? byTitle[title] : [byTitle[title]];
			for (var i = 0; i < entries.length; i++) {
				var candidate = entries[i] || {};
				this.addRecord(index, candidate.title || title, candidate, this.entryIssns(candidate));
			}
		}
		for (var linkedIssn in index.byIssn) {
			var linked = index.byIssn[linkedIssn];
			for (var linkIndex = 1; linkIndex < linked.length; linkIndex++) {
				if (this.canMergeRecords(linked[0], linked[linkIndex])) this.mergeRecords(linked[0], linked[linkIndex]);
			}
		}

		var byIssn = dataset && dataset.byIssn || {};
		for (var rawIssn in byIssn) {
			var normalizedIssn = this.normalizeIssn(rawIssn);
			if (!normalizedIssn) continue;
			var issnEntry = byIssn[rawIssn] || {};
			var existing = this.uniqueValues((index.byIssn[normalizedIssn] || []).map(this.canonicalRecord.bind(this)));
			var record;
			if (existing.length === 1) {
				record = existing[0];
				record.titles = this.uniqueValues(record.titles.concat(this.entryTitles(issnEntry, '')));
			} else if (existing.length > 1) {
				// Preserve an identifier collision as ambiguity; never pick a ranking by order.
				continue;
			} else {
				var titles = this.entryTitles(issnEntry, '');
				record = this.addRecord(index, titles[0] || '', issnEntry, [normalizedIssn]);
			}
			if (record.issns.indexOf(normalizedIssn) === -1) record.issns.push(normalizedIssn);
			this.addIndexValue(index.byIssn, normalizedIssn, record);
		}

		for (var recordIndex = 0; recordIndex < index.records.length; recordIndex++) {
			var current = this.canonicalRecord(index.records[recordIndex]);
			if (current !== index.records[recordIndex]) continue;
			for (var titleIndex = 0; titleIndex < current.titles.length; titleIndex++) {
				this.addIndexValue(index.exactTitles, this.normalizeExactTitle(current.titles[titleIndex]), current);
				this.addIndexValue(index.normalizedTitles, this.normalizeString(current.titles[titleIndex]), current);
			}
		}
		this.canonicalizeIndex(index);
		return index;
	},

	buildFlatIndex: function(dataset) {
		var index = this.newIdentityIndex();
		for (var title in dataset || {}) {
			var entries = Array.isArray(dataset[title]) ? dataset[title] : [dataset[title]];
			for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
				var entry = entries[entryIndex] || {};
				this.addRecord(index, title, entry, this.entryIssns(entry));
			}
		}
		for (var issn in index.byIssn) {
			var linked = index.byIssn[issn];
			for (var i = 1; i < linked.length; i++) {
				if (this.canMergeRecords(linked[0], linked[i])) this.mergeRecords(linked[0], linked[i]);
			}
		}
		this.canonicalizeIndex(index);
		return index;
	},

	intersects: function(left, right) {
		for (var i = 0; i < left.length; i++) if (right.indexOf(left[i]) !== -1) return true;
		return false;
	},

	recordsForIssns: function(index, issns) {
		var records = [];
		for (var i = 0; i < issns.length; i++) {
			var matches = index.byIssn[issns[i]] || [];
			for (var j = 0; j < matches.length; j++) {
				var record = this.canonicalRecord(matches[j]);
				if (records.indexOf(record) === -1) records.push(record);
			}
		}
		return records;
	},

	resolveIdentity: function(index, title, item, debugLog, label) {
		debugLog = typeof debugLog === 'function' ? debugLog : function() {};
		var inputTitle = this.toNfc(title || '').trim();
		var inputIssns = this.extractIssns(item);
		var identifierRecords = this.recordsForIssns(index, inputIssns);
		if (identifierRecords.length > 1) {
			debugLog('[' + label + '] Rejected: supplied ISSNs identify conflicting records');
			return null;
		}

		var titleRecords = [];
		var method = null;
		if (inputTitle) {
			var exactKey = this.normalizeExactTitle(inputTitle);
			titleRecords = exactKey ? (index.exactTitles[exactKey] || []).slice() : [];
			if (titleRecords.length) method = 'exact-title';
			else {
				var normalizedKey = this.normalizeString(inputTitle);
				titleRecords = normalizedKey ? (index.normalizedTitles[normalizedKey] || []).slice() : [];
				if (titleRecords.length) method = 'normalized-title';
			}
		}

		if (inputIssns.length && titleRecords.length) {
			var compatible = titleRecords.filter(function(record) {
				return !record.issns.length || this.intersects(record.issns, inputIssns);
			}, this);
			if (identifierRecords.length === 1) {
				compatible = compatible.filter(function(record) { return this.canonicalRecord(record) === identifierRecords[0]; }, this);
			}
			if (!compatible.length) {
				debugLog('[' + label + '] Rejected: title and valid ISSN identify different records');
				return null;
			}
			titleRecords = compatible;
		}

		var chosen = null;
		var matchedIssn = null;
		if (identifierRecords.length === 1) {
			chosen = identifierRecords[0];
			method = 'issn';
			for (var issnIndex = 0; issnIndex < inputIssns.length; issnIndex++) {
				if (chosen.issns.indexOf(inputIssns[issnIndex]) !== -1) { matchedIssn = inputIssns[issnIndex]; break; }
			}
		} else if (titleRecords.length === 1) chosen = titleRecords[0];
		else if (titleRecords.length > 1) {
			debugLog('[' + label + '] Rejected: title is ambiguous across ' + titleRecords.length + ' identities');
			return null;
		}
		if (!chosen) return null;

		var match = { method: method, matchedTitle: chosen.title || chosen.titles[0] || inputTitle, inputTitle: inputTitle };
		if (matchedIssn) match.matchedIssn = matchedIssn;
		if (inputIssns.length || chosen.issns.length) {
			match.evidence = { inputIssns: inputIssns.slice(), candidateIssns: chosen.issns.slice() };
		}
		return { record: chosen, entry: chosen.entry, match: match };
	},

	buildSimpleTitleIndex: function(dataset) {
		var index = { exactTitles: Object.create(null), normalizedTitles: Object.create(null) };
		for (var title in dataset || {}) {
			var candidate = { title: this.toNfc(title), entry: dataset[title] };
			this.addIndexValue(index.exactTitles, this.normalizeExactTitle(title), candidate);
			this.addIndexValue(index.normalizedTitles, this.normalizeString(title), candidate);
		}
		return index;
	},

	resolveSimpleTitle: function(index, title, debugLog, label) {
		debugLog = typeof debugLog === 'function' ? debugLog : function() {};
		var inputTitle = this.toNfc(title || '').trim();
		if (!inputTitle) return null;
		var candidates = index.exactTitles[this.normalizeExactTitle(inputTitle)] || [];
		var method = 'exact-title';
		if (!candidates.length) {
			candidates = index.normalizedTitles[this.normalizeString(inputTitle)] || [];
			method = 'normalized-title';
		}
		if (candidates.length !== 1) {
			if (candidates.length > 1) debugLog('[' + label + '] Rejected: title is ambiguous across ' + candidates.length + ' records');
			return null;
		}
		return { entry: candidates[0].entry, match: { method: method, matchedTitle: candidates[0].title, inputTitle: inputTitle } };
	},

	hasKnownIdentityConflict: function(title, item, indexes, debugLog, label) {
		var inputIssns = this.extractIssns(item);
		var inputTitle = this.toNfc(title || '').trim();
		if (!inputIssns.length || !inputTitle) return false;
		for (var i = 0; i < indexes.length; i++) {
			var index = indexes[i];
			if (!index) continue;
			var ids = this.recordsForIssns(index, inputIssns);
			var titleRecords = index.exactTitles[this.normalizeExactTitle(inputTitle)] || [];
			if (!titleRecords.length) titleRecords = index.normalizedTitles[this.normalizeString(inputTitle)] || [];
			if (ids.length > 1 || (ids.length === 1 && titleRecords.length && titleRecords.indexOf(ids[0]) === -1)) {
				debugLog('[' + label + '] Rejected title-only match: known title/ISSN conflict');
				return true;
			}
			if (titleRecords.length && titleRecords.every(function(record) {
				return record.issns.length && !this.intersects(record.issns, inputIssns);
			}, this)) {
				debugLog('[' + label + '] Rejected title-only match: supplied ISSN is incompatible');
				return true;
			}
		}
		return false;
	},

	extractAcronym: function(title) {
		var match = this.toNfc(title).match(/\(([\p{L}][\p{L}\p{N}&-]{1,})\)/u);
		return match ? match[1].toUpperCase() : null;
	},

	cleanConferenceTitle: function(title) {
		return this.toNfc(title)
			.replace(/^\s*Proceedings\s+(?:of\s+)?(?:the\s+)?/iu, '')
			.replace(/^\s*\d{4}\s+/u, '')
			.replace(/\b\d{4}\b/gu, ' ')
			.replace(/\b\d{1,3}(?:st|nd|rd|th)\s+(?:Annual\s+)?/giu, '')
			.replace(/\bAnnual\s+/giu, '')
			.replace(/\s+/gu, ' ').trim();
	},

	buildCoreIndex: function() {
		if (this.coreDataset === coreRankings && this.coreExactIndex) return;
		this.coreDataset = coreRankings;
		this.coreExactIndex = Object.create(null);
		this.coreTitleIndex = Object.create(null);
		this.coreAcronymIndex = Object.create(null);
		for (var title in coreRankings) {
			var entry = { title: title, rank: coreRankings[title] };
			this.addIndexValue(this.coreExactIndex, this.normalizeExactTitle(title), entry);
			this.addIndexValue(this.coreTitleIndex, this.normalizeString(this.cleanConferenceTitle(title)), entry);
			var acronym = this.extractAcronym(title);
			if (acronym) this.addIndexValue(this.coreAcronymIndex, acronym, entry);
		}
	},

	matchCoreConferenceDetailed: function(title, debugLog) {
		debugLog = typeof debugLog === 'function' ? debugLog : function() {};
		this.buildCoreIndex();
		var inputTitle = this.toNfc(title || '').trim();
		if (!inputTitle) return null;
		var candidates = this.coreExactIndex[this.normalizeExactTitle(inputTitle)] || [];
		var method = 'exact-title';
		var cleanedInput = this.cleanConferenceTitle(inputTitle);
		if (!candidates.length) {
			candidates = this.coreTitleIndex[this.normalizeString(cleanedInput)] || [];
			method = 'conference-title';
		}
		if (!candidates.length) {
			var standalone = inputTitle.match(/^([\p{L}][\p{L}\p{N}&-]{3,})$/u);
			var acronym = standalone ? standalone[1].toUpperCase() : null;
			if (acronym) { candidates = this.coreAcronymIndex[acronym] || []; method = 'acronym'; }
		}
		if (candidates.length !== 1) {
			if (candidates.length > 1) debugLog('[CORE] Rejected: title is ambiguous across ' + candidates.length + ' conferences');
			return null;
		}
		return {
			rank: candidates[0].rank,
			match: {
				method: method,
				matchedTitle: candidates[0].title,
				inputTitle: inputTitle,
				evidence: method === 'conference-title' ? { cleanedInput: cleanedInput } : undefined
			}
		};
	},

	matchCoreConference: function(title, debugLog) {
		var detailed = this.matchCoreConferenceDetailed(title, debugLog);
		return detailed ? detailed.rank : null;
	}
};
