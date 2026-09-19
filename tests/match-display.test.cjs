const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load() {
  const state = {badges: true, autoUpdate: true, refreshes: 0, lookups: 0, alerts: []};
  const context = vm.createContext({
    Zotero: {
      debug() {}, logError(error) {throw new Error(String(error));},
      Items: {get() {state.lookups++; return undefined;}},
      Notifier: {trigger() {state.refreshes++;}},
      alert: async (...args) => {state.alerts.push(args);}
    },
    getPref: name => name === 'enableBadges' ? state.badges : state.autoUpdate,
    RankingEngine: {getRankingArray() {state.lookups++; return [];}}
  });
  for (const file of ['src/ui/ui-utils.js', 'src/ui/column-manager.js', 'src/ui/menu-manager.js', 'src/core/rankings.js', 'src/actions/ranking-actions.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  return {context, state};
}
class Element {
  constructor(tag) {this.tagName = tag; this.children = []; this.attributes = {}; this.style = {};}
  set textContent(value) {this.text = String(value); this.children = [];}
  get textContent() {return (this.text || '') + this.children.map(child => child.textContent).join('');}
  appendChild(child) {this.children.push(child); return child;}
  setAttribute(key, value) {this.attributes[key] = String(value);}
  set innerHTML(value) {throw new Error('Tooltip metadata must never be parsed as HTML');}
}
const doc = {createElement: tag => new Element(tag), createTextNode: value => ({textContent: value})};
const sjr = {id: 'sjr', rank: 'Q1 2.5', color: '#2E7D32', match: {method: 'issn', matchedTitle: 'Example Journal', matchedIssn: '00280836', inputTitle: 'Example journal', dataset: {label: 'SJR', edition: '2025'}}};
const jcr = {id: 'jcr', rank: 'Q2 1.1', color: '#0288D1', match: {method: 'exact-title', matchedTitle: 'Another Journal', dataset: {label: 'JCR', edition: 'unknown'}}};

test('each badge displays its own cached provenance without rematching', () => {
  const {context, state} = load();
  context.ColumnManager.setCachedRanking(42, [sjr, jcr]);
  const cell = context.ColumnManager.renderCell(0, '0000|unused&&42', {className: 'ranking'}, false, doc);
  const badges = cell.children[0].children;
  assert.equal(badges.length, 2);
  assert.match(badges[0].title, /Example Journal/);
  assert.match(badges[0].title, /0028-0836/);
  assert.match(badges[0].title, /2025/);
  assert.doesNotMatch(badges[0].title, /Another Journal/);
  assert.match(badges[1].title, /Another Journal/);
  assert.match(badges[1].title, /edition unknown/i);
  assert.equal(state.lookups, 0);
});

test('text mode exposes the same per-source tooltip as badges', () => {
  const {context, state} = load();
  state.badges = false;
  context.ColumnManager.setCachedRanking(42, [sjr]);
  const cell = context.ColumnManager.renderCell(0, '0000|unused&&42', {className: 'ranking'}, false, doc);
  assert.equal(cell.children[0].title, context.UIUtils.formatMatchDetails(sjr));
  assert.match(cell.children[0].textContent, /SJR: Q1 2.5/);
});

test('manual overrides describe publication scope and never invent an automatic match', () => {
  const {context} = load();
  const text = context.UIUtils.formatMatchDetails({id: 'Manual', rank: '<custom & rank>', match: {method: 'manual-override', matchedTitle: 'Journal <name>'}});
  assert.match(text, /Manual override/i);
  assert.match(text, /publication title/i);
  assert.match(text, /Journal <name>/);
  assert.doesNotMatch(text, /ISSN|confidence|automatic result/i);
});

test('derived result describes the actual sources and SciELO adjustment', () => {
  const {context} = load();
  const text = context.UIUtils.formatMatchDetails({id: 'capesNova', rank: 'B', match: {
    method: 'source-aggregation', matchedTitle: 'Example Journal',
    sources: [sjr], evidence: {winningRule: 'SJR Q3', baseGrade: 'R', scieloAdjustment: {from: 'R', to: 'B'}},
    dataset: {label: 'Nova CAPES', edition: '2025-2028'}
  }});
  assert.match(text, /Calculated locally/i);
  assert.match(text, /SJR.*Q1 2.5/);
  assert.match(text, /Example Journal/);
  assert.match(text, /SciELO.*applied/i);
});

test('metadata edits invalidate result and provenance even with auto-update disabled', async () => {
  const {context, state} = load();
  state.autoUpdate = false;
  context.ColumnManager.setCachedRanking(42, [sjr]);
  await context.ZoteroRankings.notify('modify', 'item', [42], {});
  assert.equal(context.ColumnManager.getCachedRanking(42), undefined);
  assert.equal(state.refreshes, 0);
});

test('match details are available through a selected-item action without hover', async () => {
  const {context, state} = load();
  const item = {id: 42, isRegularItem: () => true, getField: () => 'Article title'};
  context.RankingEngine.getRankingArray = () => [sjr];
  await context.RankingActions.showMatchDetails({ZoteroPane: {getSelectedItems: () => [item]}});
  assert.equal(state.alerts.length, 1);
  assert.match(state.alerts[0][2], /Example Journal/);
  assert.match(state.alerts[0][2], /0028-0836/);
});


test('details menus register once and are removed on plugin cleanup', () => {
  const {context} = load();
  const roots = [];
  class MenuElement extends Element {
    addEventListener(name, handler) {this.attributes[name] = handler;}
    appendChild(child) {child.parent = this; return super.appendChild(child);}
    remove() {this.parent.children = this.parent.children.filter(child => child !== this);}
  }
  const toolsMenu = new MenuElement('menupopup');
  toolsMenu.id = 'menu_ToolsPopup';
  const contextMenu = new MenuElement('menupopup');
  contextMenu.id = 'zotero-itemmenu';
  roots.push(toolsMenu, contextMenu);
  const nodes = () => roots.flatMap(parent => [parent, ...parent.children]);
  const menuDoc = {
    readyState: 'complete',
    createXULElement: tag => new MenuElement(tag),
    getElementById: id => nodes().find(node => node.id === id),
    querySelectorAll: selector => nodes().filter(node => '#' + node.id === selector)
  };
  let invoked = 0;
  const handlers = {onMatchDetails: () => {invoked++;}};
  const window = {document: menuDoc};
  context.MenuManager.addToWindow(window, handlers);
  context.MenuManager.addToWindow(window, handlers);
  for (const id of ['zotero-rankings-match-details', 'zotero-rankings-context-match-details']) {
    assert.equal(nodes().filter(node => node.id === id).length, 1);
    menuDoc.getElementById(id).attributes.command();
  }
  assert.equal(invoked, 2);
  context.MenuManager.removeFromWindow(window);
  assert.equal(nodes().filter(node => node.id.includes('match-details')).length, 0);
});
