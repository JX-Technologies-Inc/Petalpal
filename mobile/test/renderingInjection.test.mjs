import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { hookHarness } from './hookHarness.mjs';
import { loadPlantingModules } from './loadPlantingModules.mjs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const payload = '<script>alert(1)</script><img src=x onerror=alert(2)> & "quotes"';
const link = '<a href="javascript:alert(3)">link</a> data:text/html,<svg onload=alert(4)>';
const jsx = (type, props) => ({ type, props });
const native = Object.fromEntries(['Image', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View', 'ActivityIndicator']
  .map(name => [name, name]));
Object.assign(native, {
  StyleSheet: { create: styles => styles, absoluteFill: {} }, Platform: { OS: 'web' },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
  useWindowDimensions: () => ({ width: 800, height: 900 }),
  Animated: { View: 'View', Image: 'Image',
    Value: class { interpolate() { return 0; } stopAnimation() {} },
    timing: () => ({ start() {}, stop() {} }) },
});
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return tree && typeof tree === 'object' ? [tree, ...elements(tree.props?.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : String(tree ?? '');
}
function assertLiteral(tree, value) {
  assert.ok(elements(tree).some(node => node.type === 'Text' && text(node).includes(value)),
    'untrusted content must remain a Text child');
  for (const node of elements(tree)) {
    assert.equal(node.props?.dangerouslySetInnerHTML, undefined);
    assert.equal(node.props?.href, undefined);
    assert.equal(node.props?.source?.html, undefined);
    assert.ok(!['WebView', 'a', 'script', 'iframe'].includes(node.type));
  }
}
function loader(hooks, dependencies = {}) {
  return loadPlantingModules(undefined, hooks.react, undefined, true, {
    'react-native': native, 'react/jsx-runtime': { jsx, jsxs: jsx },
    runtimeGlobals: { AbortController }, ...dependencies,
  });
}

test('native Flower journal/AI/social payloads remain text, never HTML or links', () => {
  const placement = { id: 'placement', flowerId: 'flower', month: 1, landId: 'Land01' };
  const value = { selectedFlower: placement, selectedFlowerIsOwner: true, currentUserId: 'owner',
    flowerDetailSource: { id: 'flower', name: 'Sunflower', mood: 'Calm', supportCount: 0,
      dailyCheckIn: { journal: { id: 'journal', content: payload } }, meaning: link,
      messages: [{ author: payload, text: link }] } };
  const hooks = hookHarness();
  const Component = loader(hooks, { './PlantingContext': { usePlanting: () => value },
    './plantingRegionData': { MONTH_REGION_METAS: { 1: { monthName: 'January', landId: 'Land01' } } },
  })('FlowerDetailModal').default;
  const tree = hooks.mount(() => Component());
  assertLiteral(tree, payload);
  assertLiteral(tree, link);
});

test('measured journal pages preserve hostile markup and URL text without interpreting it', () => {
  const hooks = hookHarness();
  const { MeasuredPages } = loader(hooks)('../../bookhouse/JournalPages');
  const content = `${payload}\n${link}\nhttps://example.test/legitimate`;
  const paper = { width: 400, height: 500, bookWidth: 900, bookHeight: 700,
    inset: 25, top: 30, bottom: 25, date: '2026-10-08' };
  let tree = hooks.mount(() => MeasuredPages({ text: content, width: 300, height: 350, textStyle: {}, paper }));
  const probe = elements(tree).find(node => node.type === 'Text' && node.props.onLayout);
  assert.ok(probe);
  probe.props.onLayout({ nativeEvent: { layout: { height: 20 } } });
  tree = hooks.render();
  const pages = elements(tree).filter(node => node.type === 'Text' && node.props.selectable);
  assert.equal(pages.map(text).join(''), content);
  assertLiteral(tree, payload);
  assertLiteral(tree, link);
});

test('saved AI summaries, narrative fallback and topics render literal hostile text', async () => {
  for (const summary of [payload, '']) {
    const hooks = hookHarness();
    const report = { id: 'report', type: 'weekly', periodKey: '2026-W40' };
    const Component = loader(hooks, {
      'expo-router': { useRouter: () => ({ replace() {} }) },
      '../components/garden/world-time': { useWorldTime: () => ({ isTreehouseLightingTime: false }) },
      '../services/reflections': {
        listReflections: async () => ({ reports: [report], nextCursor: null }),
        readReflection: async () => ({ ...report, summary,
          narrativeSections: [{ claim: payload }], topTopics: [{ topic: link, count: 1 }] }),
      },
    })('../../../app/reflection').default;
    hooks.mount(() => Component());
    const tree = await hooks.flush();
    assertLiteral(tree, payload);
    assertLiteral(tree, link);
  }
});

test('active external hrefs are fixed HTTPS; untrusted friend IDs stay fixed-route parameters', async () => {
  let links = 0;
  for (const file of ['../src/app/explore.tsx', '../src/components/app-tabs.web.tsx']) {
    const source = ts.createSourceFile(file, fs.readFileSync(new URL(file, import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'ExternalLink') {
        const href = node.attributes.properties.find(attribute => attribute.name?.getText(source) === 'href');
        assert.ok(href && ts.isStringLiteral(href.initializer), 'review any newly dynamic external URL source');
        assert.equal(new URL(href.initializer.text).protocol, 'https:');
        links++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(links > 0);
  const id = 'javascript:alert(1)/../../%2f?redirect=https://evil.test#fragment';
  const calls = [];
  const hooks = hookHarness();
  const Component = loader(hooks, {
    './PanelTheme': { usePanelTheme: () => ({ theme: {}, light: true }) },
    './FeatureUI': { FEATURE_COLORS: {}, FeatureActionButton: 'FeatureActionButton', ui: {} },
    'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { push: value => calls.push(value) } },
    '../../services/auth': { useAuth: () => ({ session: { user: { id: 'owner' } } }) },
    '../../services/friends': {
      loadFriends: async () => [{ id, name: payload, allowGardenVisits: true }],
      loadFriendRequests: async () => ({ incoming: [], outgoing: [] }),
    },
  })('../../features/FriendsPanel').FriendsPanel;
  hooks.mount(() => Component());
  const tree = await hooks.flush();
  assertLiteral(tree, payload);
  const visit = elements(tree).find(node => node.props?.testID === `visit-${id}`);
  assert.ok(visit);
  visit.props.onPress();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/visit/[ownerId]');
  assert.equal(calls[0].params.ownerId, id);
});
