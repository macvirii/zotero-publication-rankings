/**
 * Qualis CAPES 2021-2024 Database Plugin
 *
 * Uses the official CAPES XLSX aggregated across all evaluation areas.
 * When a journal appears in multiple areas, the best stratum is used.
 */

/* global MatchingUtils, DatabaseRegistry, qualisCapes2021Rankings */

var QualisCapesDatabase = {
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

    findByTitle: function(title) {
        var byTitle = qualisCapes2021Rankings.byTitle || {};
        var exact = title.trim().toLowerCase();
        if (byTitle[exact]) {
            return byTitle[exact];
        }

        var normalized = MatchingUtils.normalizeString(title);
        for (var qualisTitle in byTitle) {
            if (MatchingUtils.normalizeString(qualisTitle) === normalized) {
                return byTitle[qualisTitle];
            }
        }
        return null;
    },

    match: function(title, debugLog, item) {
        debugLog('[Qualis CAPES] Retrieving ranking from database...');

        var byIssn = qualisCapes2021Rankings.byIssn || {};
        var issns = this.extractIssns(item);
        for (var i = 0; i < issns.length; i++) {
            if (byIssn[issns[i]]) {
                debugLog('[Qualis CAPES] ✓ ISSN match: ' + issns[i] + ' -> ' + byIssn[issns[i]].qualis);
                return byIssn[issns[i]].qualis;
            }
        }

        var entry = this.findByTitle(title);
        if (entry) {
            debugLog('[Qualis CAPES] ✓ Title match -> ' + entry.qualis);
            return entry.qualis;
        }

        debugLog('[Qualis CAPES] Journal NOT found: "' + title + '"');
        return null;
    }
};

DatabaseRegistry.register({
    id: 'qualisCapes',
    name: 'Qualis CAPES 2021-2024',
    prefKey: 'enableQualisCapes',
    priority: 103,
    matcher: function(title, debugLog, item) {
        return QualisCapesDatabase.match(title, debugLog, item);
    }
});
