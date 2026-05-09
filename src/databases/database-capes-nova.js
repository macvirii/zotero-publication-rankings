/**
 * Nova Classificacao CAPES Database Plugin
 *
 * Calculates the Area 27 2025-2028 classification locally from source lists:
 * ABDC, ABS, JCR, SJR, SPELL, and SciELO Brasil.
 */

/* global MatchingUtils, DatabaseRegistry, abdcRankings, absRankings, jcrRankings, sjrRankings, spellRankings, scieloRankings */

var CapesNovaDatabase = {
    simpleTitleIndexes: Object.create(null),
    sjrIssnIndex: null,

    gradeValue: {
        'I': 0,
        'F': 1,
        'R': 2,
        'B': 3,
        'MB': 4
    },

    getStructuredTitleIndex: function(dataset) {
        if (!dataset._normalizedTitleIndex) {
            dataset._normalizedTitleIndex = Object.create(null);
            var byTitle = dataset.byTitle || {};
            for (var title in byTitle) {
                var normalized = MatchingUtils.normalizeString(title);
                if (!dataset._normalizedTitleIndex[normalized]) {
                    dataset._normalizedTitleIndex[normalized] = byTitle[title];
                }
            }
        }
        return dataset._normalizedTitleIndex;
    },

    getSimpleTitleIndex: function(name, dataset) {
        if (!this.simpleTitleIndexes[name]) {
            var index = Object.create(null);
            for (var title in dataset) {
                var normalized = MatchingUtils.normalizeString(title);
                if (!index[normalized]) {
                    index[normalized] = dataset[title];
                }
            }
            this.simpleTitleIndexes[name] = index;
        }
        return this.simpleTitleIndexes[name];
    },

    getSjrIssnIndex: function() {
        if (this.sjrIssnIndex) {
            return this.sjrIssnIndex;
        }

        this.sjrIssnIndex = Object.create(null);
        for (var title in sjrRankings) {
            var issns = sjrRankings[title].issns || [];
            for (var i = 0; i < issns.length; i++) {
                if (!this.sjrIssnIndex[issns[i]]) {
                    this.sjrIssnIndex[issns[i]] = sjrRankings[title];
                }
            }
        }
        return this.sjrIssnIndex;
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

    findStructuredEntry: function(dataset, title, item) {
        if (!dataset) {
            return null;
        }

        var byIssn = dataset.byIssn || {};
        var issns = this.extractIssns(item);
        for (var i = 0; i < issns.length; i++) {
            if (byIssn[issns[i]]) {
                return byIssn[issns[i]];
            }
        }

        var byTitle = dataset.byTitle || {};
        var exact = title.trim().toLowerCase();
        if (byTitle[exact]) {
            return byTitle[exact];
        }

        return this.getStructuredTitleIndex(dataset)[MatchingUtils.normalizeString(title)] || null;
    },

    findSimpleTitleEntry: function(name, dataset, title) {
        var exact = title.trim().toLowerCase();
        if (dataset[exact]) {
            return dataset[exact];
        }

        return this.getSimpleTitleIndex(name, dataset)[MatchingUtils.normalizeString(title)] || null;
    },

    findSjrEntry: function(title, item) {
        var issns = this.extractIssns(item);
        var issnIndex = this.getSjrIssnIndex();
        for (var i = 0; i < issns.length; i++) {
            if (issnIndex[issns[i]]) {
                return issnIndex[issns[i]];
            }
        }

        return this.findSimpleTitleEntry('sjr', sjrRankings, title);
    },

    addBestGrade: function(current, candidate) {
        if (!candidate) {
            return current;
        }
        if (!current || this.gradeValue[candidate] > this.gradeValue[current]) {
            return candidate;
        }
        return current;
    },

    gradeFromQuartile: function(quartile) {
        switch (quartile) {
            case 'Q1': return 'MB';
            case 'Q2': return 'B';
            case 'Q3': return 'R';
            case 'Q4': return 'F';
            default: return null;
        }
    },

    gradeFromAbdc: function(abdc) {
        switch (abdc) {
            case 'A*':
            case 'A':
                return 'MB';
            case 'B':
                return 'B';
            case 'C':
                return 'R';
            default:
                return null;
        }
    },

    gradeFromAbs: function(abs) {
        if (abs === '4*' || abs === '4' || abs === '3' || abs === '2') {
            return 'MB';
        }
        if (abs === '1') {
            return 'B';
        }
        return null;
    },

    gradeFromSpell: function(spellClass, inScielo) {
        if (spellClass === 'top10') {
            return inScielo ? 'B' : null;
        }
        if (spellClass === 'next30') {
            return 'R';
        }
        if (spellClass === 'next30_2') {
            return 'F';
        }
        return null;
    },

    applyScieloAdjustment: function(grade, inScielo) {
        if (!grade || !inScielo) {
            return grade;
        }
        if (grade === 'F') {
            return 'R';
        }
        if (grade === 'R') {
            return 'B';
        }
        return grade;
    },

    match: function(title, debugLog, item) {
        debugLog('[Nova CAPES] Calculating local classification...');

        var bestGrade = null;
        var matchedAnySource = false;

        var scieloEntry = this.findStructuredEntry(scieloRankings, title, item);
        var inScielo = !!scieloEntry;
        if (inScielo) {
            matchedAnySource = true;
            debugLog('[Nova CAPES] Source SciELO: yes');
        }

        var abdcEntry = this.findStructuredEntry(abdcRankings, title, item);
        if (abdcEntry && abdcEntry.abdc) {
            matchedAnySource = true;
            bestGrade = this.addBestGrade(bestGrade, this.gradeFromAbdc(abdcEntry.abdc));
            debugLog('[Nova CAPES] Source ABDC: ' + abdcEntry.abdc + ' -> ' + bestGrade);
        }

        var absEntry = this.findSimpleTitleEntry('abs', absRankings, title);
        if (absEntry && absEntry.abs) {
            matchedAnySource = true;
            bestGrade = this.addBestGrade(bestGrade, this.gradeFromAbs(absEntry.abs));
            debugLog('[Nova CAPES] Source ABS: ' + absEntry.abs + ' -> ' + bestGrade);
        }

        var jcrEntry = this.findStructuredEntry(jcrRankings, title, item);
        var jcrQuartile = jcrEntry && (jcrEntry.jcr || jcrEntry.quartile);
        if (jcrQuartile) {
            matchedAnySource = true;
            bestGrade = this.addBestGrade(bestGrade, this.gradeFromQuartile(jcrQuartile));
            debugLog('[Nova CAPES] Source JCR: ' + jcrQuartile + ' -> ' + bestGrade);
        }

        var sjrEntry = this.findSjrEntry(title, item);
        if (sjrEntry && sjrEntry.quartile) {
            matchedAnySource = true;
            bestGrade = this.addBestGrade(bestGrade, this.gradeFromQuartile(sjrEntry.quartile));
            debugLog('[Nova CAPES] Source SJR: ' + sjrEntry.quartile + ' -> ' + bestGrade);
        }

        var spellEntry = this.findStructuredEntry(spellRankings, title, item);
        if (spellEntry && spellEntry.spell) {
            matchedAnySource = true;
            bestGrade = this.addBestGrade(bestGrade, this.gradeFromSpell(spellEntry.spell, inScielo));
            debugLog('[Nova CAPES] Source SPELL: ' + spellEntry.spell + ' -> ' + bestGrade);
        }

        bestGrade = this.applyScieloAdjustment(bestGrade, inScielo);
        if (bestGrade) {
            debugLog('[Nova CAPES] ✓ Classification: ' + bestGrade);
            return bestGrade;
        }

        if (matchedAnySource) {
            debugLog('[Nova CAPES] ✓ Matched source, no qualifying rule -> I');
            return 'I';
        }

        debugLog('[Nova CAPES] Journal NOT found: "' + title + '"');
        return null;
    }
};

DatabaseRegistry.register({
    id: 'capesNova',
    name: 'Nova Classificacao CAPES',
    prefKey: 'enableCapesNova',
    priority: 104,
    matcher: function(title, debugLog, item) {
        return CapesNovaDatabase.match(title, debugLog, item);
    }
});
