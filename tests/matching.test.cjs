const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourceFiles = [
  'src/engine/matching.js',
  'src/databases/database-registry.js',
  'src/databases/database-sjr.js',
  'src/databases/database-jcr.js',
  'src/databases/database-core.js',
  'src/databases/database-abs.js',
  'src/databases/database-abdc.js',
  'src/databases/database-ft-50.js',
  'src/databases/database-qualis-capes.js',
  'src/databases/database-capes-nova.js',
  'src/databases/database-spell.js',
  'src/engine/ranking-engine.js'
];

function makeContext(overrides = {}) {
  const context = {
    console,
    Map,
    WeakMap,
    Zotero: { debug() {}, logError(error) { throw new Error(String(error)); } },
    getPref() { return true; },
    ManualOverrides: { get() { return null; } },
    UIUtils: {
      getRankingColor() { return '#000'; },
      getDatabaseLabel(id) { return id.toUpperCase(); }
    },
    rankingDatasetMetadata: {
      sjr: { label: 'SCImago', edition: '2024', source: 'fixture' },
      capesNova: { label: 'Nova', edition: '2025-2028' }
    },
    sjrRankings: {},
    jcrRankings: { byTitle: {}, byIssn: {} },
    coreRankings: {},
    absRankings: {},
    abdcRankings: { byTitle: {}, byIssn: {} },
    ft50Rankings: [],
    qualisCapes2021Rankings: { byTitle: {}, byIssn: {} },
    scieloRankings: { byTitle: {}, byIssn: {} },
    spellRankings: { byTitle: {}, byIssn: {} },
    ...overrides
  };
  vm.createContext(context);
  for (const file of sourceFiles) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

function item(fields = {}) {
  return {
    isRegularItem() { return true; },
    getField(name) { return fields[name] || ''; }
  };
}

const quiet = () => {};

test('ISSN extraction validates checksums and token boundaries', () => {
  const { MatchingUtils } = makeContext();
  assert.deepEqual([...MatchingUtils.extractIssnsFromValue('0007-9235; 1542 4863')], ['00079235', '15424863']);
  assert.deepEqual([...MatchingUtils.extractIssnsFromValue('bad 1234-5678 and 0007923500')], []);
});

test('SJR resolves grouped identifiers and rejects title/identifier conflicts', () => {
  const context = makeContext({
    sjrRankings: {
      'ca-a cancer journal for clinicians': { quartile: 'Q1', sjr: 145.004, issns: ['00079235', '15424863'] },
      'journal of another field': { quartile: 'Q4', sjr: 0.1, issns: ['21801347'] }
    }
  });
  const byElectronic = context.SJRDatabase.matchDetailed('', quiet, item({ ISSN: '1542-4863' }));
  assert.equal(byElectronic.rank, 'Q1 145.004');
  assert.equal(byElectronic.match.method, 'issn');
  assert.equal(context.SJRDatabase.matchDetailed('ca-a cancer journal for clinicians', quiet, item({ ISSN: '2180-1347' })), null);
  assert.equal(context.SJRDatabase.matchDetailed('', quiet, item({ ISSN: '0007-9235; 2180-1347' })), null);
});

test('SJR rejects duplicate title identities and duplicate-source ISSN collisions', () => {
  const context = makeContext({
    sjrRankings: {
      'forum of mathematics': [
        { sourceId: 'one', quartile: 'Q1', sjr: 2, issns: ['00079235'] },
        { sourceId: 'two', quartile: 'Q4', sjr: 0.2, issns: ['21801347'] }
      ],
      'coling proceedings': [
        { sourceId: 'three', quartile: 'Q2', sjr: 0.395, issns: ['29512093'] },
        { sourceId: 'four', quartile: 'Q2', sjr: 0.328, issns: ['29512093'] }
      ],
      'equal-rating collision': [
        { sourceId: 'five', quartile: 'Q3', sjr: 0.25, issns: ['16666046'] },
        { sourceId: 'six', quartile: 'Q3', sjr: 0.25, issns: ['16666046'] }
      ]
    }
  });
  assert.equal(context.SJRDatabase.matchDetailed('forum of mathematics', quiet, item()), null);
  assert.equal(context.SJRDatabase.matchDetailed('coling proceedings', quiet, item({ ISSN: '2951-2093' })), null);
  assert.equal(context.SJRDatabase.matchDetailed('equal-rating collision', quiet, item({ ISSN: '1666-6046' })), null);
  assert.equal(context.SJRDatabase.matchDetailed('forum of mathematics', quiet, item({ ISSN: '2180-1347' })).rank, 'Q4 0.2');
});

test('normalization preserves Unicode identity and telecommunications wording', () => {
  const nfc = 'Revista de Administração';
  const context = makeContext({
    sjrRankings: {
      [nfc.toLowerCase()]: { quartile: 'Q2', sjr: 1, issns: ['00079235'] },
      'ieee conference on telecommunications': { quartile: 'Q3', sjr: 0.3, issns: ['21801347'] },
      'ieee conference on communications': { quartile: 'Q1', sjr: 2, issns: ['10447318'] }
    }
  });
  assert.equal(context.SJRDatabase.matchDetailed(nfc.normalize('NFD'), quiet, item()).rank, 'Q2 1');
  assert.equal(context.SJRDatabase.matchDetailed('IEEE Conference on Telecommunications', quiet, item()).rank, 'Q3 0.3');
});

test('JCR treats normalized collisions as ambiguous unless ISSN disambiguates', () => {
  const context = makeContext({
    jcrRankings: {
      byTitle: {
        'journal of computer science & technology': { jcr: 'Q4', jif: 1.2, issns: ['16666046'] },
        'journal of computer science and technology': { jcr: 'Q2', jif: 3.1, issns: ['00079235'] }
      },
      byIssn: {
        '16666046': { jcr: 'Q4', jif: 1.2, title: 'journal of computer science & technology' },
        '00079235': { jcr: 'Q2', jif: 3.1, title: 'journal of computer science and technology' }
      }
    }
  });
  const title = 'Journal of Computer Science & Technology.';
  assert.equal(context.JCRDatabase.matchDetailed(title, quiet, item()), null);
  assert.equal(context.JCRDatabase.matchDetailed(title, quiet, item({ ISSN: '1666-6046' })).rank, 'Q4 1.2');
});

test('Qualis object-or-array title entries remain distinct identities', () => {
  const context = makeContext({
    qualisCapes2021Rankings: {
      byTitle: {
        'same journal': [
          { qualis: 'A1', issns: ['00079235'], title: 'same journal' },
          { qualis: 'B2', issns: ['21801347'], title: 'same journal' }
        ]
      },
      byIssn: {
        '00079235': { qualis: 'A1', titles: ['same journal'] },
        '21801347': { qualis: 'B2', titles: ['same journal'] }
      }
    }
  });
  assert.equal(context.QualisCapesDatabase.matchDetailed('same journal', quiet, item()), null);
  assert.equal(context.QualisCapesDatabase.matchDetailed('same journal', quiet, item({ ISSN: '2180-1347' })).rank, 'B2');
});

test('CORE only uses complete deterministic titles, decoration cleanup, or standalone unique acronyms', () => {
  const context = makeContext({
    coreRankings: {
      'IEEE International Conference on Computer Science and Telecommunications (CST)': 'C [2023]',
      'IEEE International Conference on Computer Science and Communications (CSC)': 'B [2023]',
      'Conference on Computer and Communications Security (CCCS)': 'A* [2023]'
    }
  });
  assert.equal(context.COREDatabase.matchDetailed('IEEE International Conference on Computer Science', quiet), null);
  assert.equal(context.COREDatabase.matchDetailed('Proceedings of the 2024 IEEE International Conference on Computer Science and Telecommunications (CST)', quiet).rank, 'C [2023]');
  assert.equal(context.COREDatabase.matchDetailed('CCCS', quiet).rank, 'A* [2023]');
  assert.equal(context.COREDatabase.matchDetailed('Unrelated Symposium (CCCS)', quiet), null);
});

test('Nova aggregates only compatible source identities and exposes source evidence', () => {
  const context = makeContext({
    sjrRankings: {
      'international journal of human computer interaction': { quartile: 'Q1', sjr: 2, issns: ['10447318', '15327590'] }
    },
    abdcRankings: {
      byTitle: {
        'international journal of human computer interaction': { abdc: 'C', issns: ['21801347'] }
      },
      byIssn: {
        '21801347': { abdc: 'C', title: 'international journal of human computer interaction' }
      }
    }
  });
  const result = context.CapesNovaDatabase.matchDetailed(
    'international journal of human computer interaction', quiet, item({ ISSN: '2180-1347' })
  );
  assert.equal(result.rank, 'R');
  assert.deepEqual(Array.from(result.match.sources, source => source.id), ['abdc']);
  assert.match(result.match.evidence.winningRule, /^abdc C -> R$/);
});

test('RankingEngine preserves manual output, FT50 membership, metadata, and ISSN-only matches', () => {
  const context = makeContext({
    sjrRankings: {
      'journal of finance': { quartile: 'Q1', sjr: 10, issns: ['00221082', '15406261'] }
    },
    ft50Rankings: ['journal of finance'],
    ManualOverrides: { get(title) { return title === 'Manual Journal' ? 'Owner value' : null; } }
  });
  assert.equal(context.RankingEngine.getRanking(item({ publicationTitle: 'Manual Journal' })), 'Owner value');
  const titleResults = context.RankingEngine.getRankingArray(item({ publicationTitle: 'journal of finance' }));
  assert.equal(titleResults.find(entry => entry.id === 'ft50').rank, ' ');
  assert.equal(titleResults.find(entry => entry.id === 'sjr').match.dataset.edition, '2024');
  const issnOnly = context.RankingEngine.getRankingArray(item({ ISSN: '0022-1082' }));
  assert.equal(issnOnly.find(entry => entry.id === 'sjr').match.method, 'issn');
});

test('publication title extraction skips whitespace-only higher-priority fields', () => {
  const context = makeContext();
  assert.equal(context.RankingEngine.extractPublicationTitle(item({ publicationTitle: '  ', proceedingsTitle: 'Proceedings Name' })), 'Proceedings Name');
});
