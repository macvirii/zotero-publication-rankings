// End-to-end regressions against the bundled ranking data, using Zotero item stubs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({
  Zotero: {debug() {}, logError(error) { throw new Error(String(error)); }},
  getPref: () => true,
  ManualOverrides: {get() { return undefined; }}
});
for (const file of [
  'src/data/data.js', 'src/engine/matching.js', 'src/ui/ui-utils.js',
  'src/databases/database-registry.js',
  ...['sjr', 'jcr', 'core', 'abs', 'abdc', 'ft-50', 'qualis-capes', 'capes-nova', 'spell'].map(id => `src/databases/database-${id}.js`),
  'src/engine/ranking-engine.js'
]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
const item = (title, issn = '') => ({isRegularItem: () => true, getField: field => ({publicationTitle: title, ISSN: issn})[field] || ''});
const find = (database, title, issn = '') => context[database].matchDetailed(title, () => {}, item(title, issn));

test('SJR full-title punctuation does not change the journal identity', () => {
  const exact = find('SJRDatabase', 'Journal of Neurology');
  const punctuated = find('SJRDatabase', 'Journal of Neurology.');
  assert.ok(exact);
  assert.equal(punctuated.rank, exact.rank);
  assert.equal(punctuated.match.matchedTitle, 'journal of neurology');
  assert.equal(find('SJRDatabase', 'Forum of Mathematics'), null);
});

test('SJR preserves different journals sharing the Engineering title', () => {
  assert.ok(Array.isArray(context.sjrRankings.engineering));
  assert.equal(find('SJRDatabase', 'Engineering'), null);
  const high = find('SJRDatabase', 'Engineering', '2095-8099');
  const low = find('SJRDatabase', 'Engineering', '0013-7782');
  assert.equal(high.rank, 'Q1 1.899');
  assert.equal(low.rank, 'Q4 0.1');
  assert.equal(high.match.matchedIssn.replace('-', ''), '20958099');
  assert.equal(low.match.matchedIssn.replace('-', ''), '00137782');
});

test('CORE rejects generic descriptions and preserves Telecommunications identity', () => {
  assert.equal(find('COREDatabase', 'IEEE International Conference on Computer Science'), null);
  assert.equal(find('COREDatabase', 'International Conference on Computer Science'), null);
  const title = 'IEEE International Conference on Telecommunications';
  const result = find('COREDatabase', title);
  assert.ok(result);
  assert.equal(result.rank, context.coreRankings[title]);
  assert.equal(result.match.matchedTitle, title);
});

test('JCR normalization ambiguity requires an identifier', () => {
  assert.equal(find('JCRDatabase', 'Journal of Computer Science &  Technology').rank, 'Q4 0.7');
  const title = 'Journal of Computer Science & Technology.';
  assert.equal(find('JCRDatabase', title), null);
  const result = find('JCRDatabase', title, '1666-6046');
  assert.ok(result);
  assert.equal(result.rank, 'Q4 0.7');
  assert.equal(result.match.matchedIssn.replace('-', ''), '16666046');
});

test('Qualis identical journal names are not merged across ISSNs', () => {
  const title = 'revista da faculdade de direito';
  assert.ok(Array.isArray(context.qualisCapes2021Rankings.byTitle[title]));
  assert.equal(find('QualisCapesDatabase', title), null);
  assert.equal(find('QualisCapesDatabase', title, '0303-9838').rank, 'C');
  assert.equal(find('QualisCapesDatabase', title, '0104-0367').rank, 'A2');
});

test('Nova CAPES does not borrow another human-computer interaction journal rating', () => {
  const title = 'international journal of human computer interaction';
  assert.equal(find('JCRDatabase', title, '2180-1347'), null);
  assert.equal(find('CapesNovaDatabase', title, '2180-1347'), null);
});

test('ISSN-only items resolve, while conflicting known journal titles do not', () => {
  const ranks = context.RankingEngine.getRankingArray(item('', '0028-0836'));
  assert.ok(ranks.some(entry => entry.id === 'sjr' && entry.match.matchedIssn.replace('-', '') === '00280836'));
  assert.ok(ranks.some(entry => entry.id === 'jcr'));
  const conflicting = context.RankingEngine.getRankingArray(item('Science', '0028-0836'));
  assert.equal(conflicting.some(entry => ['sjr', 'jcr'].includes(entry.id)), false);
});

test('visually equivalent Portuguese Unicode titles match SPELL identically', () => {
  const title = 'revista de administração contemporânea';
  assert.equal(find('SPELLDatabase', title).rank, 'Top 10%');
  assert.equal(find('SPELLDatabase', title.normalize('NFD')).rank, 'Top 10%');
});

test('refreshed editions retain the additional fork datasets', () => {
  assert.ok(Object.keys(context.sjrRankings).length >= 31753);
  assert.ok(Object.keys(context.coreRankings).length >= 2210);
  assert.equal(context.rankingDatasetMetadata.sjr.edition, '2025');
  assert.match(context.rankingDatasetMetadata.core.edition, /2026/);
  assert.ok(Object.keys(context.jcrRankings.byTitle).length >= 20047);
  assert.equal(Object.keys(context.spellRankings.byTitle).length, 111);
});
