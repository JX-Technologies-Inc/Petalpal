import test from 'node:test';
import assert from 'node:assert/strict';
import { hookHarness } from './flowerDetail.test.mjs';
import { loadPlantingModules } from './loadPlantingModules.mjs';
const jsx = (type, props) => ({ type, props });
const paper = { width: 220, height: 260, bookWidth: 560, bookHeight: 340, inset: 20, top: 35, bottom: 5, date: 'Oct 3' };
const children = node => [node, ...[node?.props?.children].flat(Infinity).filter(Boolean).flatMap(child => typeof child === 'object' ? children(child) : [])];

test('measured journal pages preserve long text and support next/previous without overflow', async () => {
  for (const text of ['A quiet day.\n\n'.repeat(120), '風'.repeat(1500), 'word'.repeat(400), '🌸 '.repeat(400)]) {
    const hooks = hookHarness();
    const load = loadPlantingModules(undefined, hooks.react, undefined, true, {
      'react-native': { AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'web' }, Animated: { Value: class { interpolate() { return 0; } stopAnimation() {} } }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } },
      'react/jsx-runtime': { jsx, jsxs: jsx },
    });
    const { MeasuredPages } = load('../../bookhouse/JournalPages');
    let tree = hooks.mount(() => MeasuredPages({ text, width: 180, height: 102, textStyle: {}, paper }));
    // Supply a deterministic line-layout engine; every glyph has finite capacity.
    for (let i = 0; i < 1000; i++) {
      const probe = children(tree).find(n => n.props?.onLayout);
      if (!probe) break;
      probe.props.onLayout({ nativeEvent: { layout: { height: Math.ceil([...probe.props.children].length / 20) * 20 } } });
      tree = await hooks.flush();
      assert.ok(i < 999, 'pagination must terminate');
    }
    const pageTexts = node => children(node).filter(n => n.props?.selectable).map(n => n.props.children);
    const collected = [];
    const visited = [];
    for (let i = 0; i < 100; i++) {
      const values = pageTexts(tree); visited.push(values); collected.push(...values); assert.ok(values.every(value => [...value].length <= 100));
      const next = children(tree).find(n => n.props?.accessibilityLabel === 'Next journal page');
      if (!next || next.props.disabled) break;
      next.props.onPress(); tree = await hooks.flush();
    }
    assert.equal(collected.join(''), text);
    const previous = children(tree).find(n => n.props?.accessibilityLabel === 'Previous journal page');
    previous.props.onPress(); tree = await hooks.flush(); assert.deepEqual(pageTexts(tree), visited.at(-2));
  }
});

test('paper turns use opposite directions, lock navigation, and commit only on completion', async () => {
  const hooks = hookHarness();
  let finish, timing;
  const ranges = [];
  const load = loadPlantingModules(undefined, hooks.react, undefined, true, {
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x, absoluteFill: {} },
      Platform: { OS: 'ios' }, Easing: { cubic: x => x, inOut: x => x },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      Animated: { View: 'Animated.View', Value: class { setValue() {} stopAnimation() {} interpolate(value) { ranges.push(value.outputRange); return 0; } },
        timing: (_, options) => { timing = options; return { start: callback => { finish = callback; } }; } },
    }, 'react/jsx-runtime': { jsx, jsxs: jsx },
  });
  const { MeasuredPages } = load('../../bookhouse/JournalPages');
  let tree = hooks.mount(() => MeasuredPages({ text: 'word '.repeat(50), width: 100, height: 102, textStyle: {}, paper }));
  for (let i = 0; i < 100; i++) {
    const probe = children(tree).find(n => n.props?.onLayout);
    if (!probe) break;
    probe.props.onLayout({ nativeEvent: { layout: { height: Math.ceil(probe.props.children.length / 20) * 20 } } });
    tree = await hooks.flush();
  }
  const button = name => children(tree).find(n => n.props?.accessibilityLabel === name);
  button('Next journal page').props.onPress(); tree = await hooks.flush();
  assert.equal(timing.duration, 520); assert.equal(timing.useNativeDriver, true);
  assert.ok(ranges.some(r => r[0] === '0deg' && r[1] === '-180deg'));
  assert.equal(button('Next journal page').props.disabled, true);
  const leaf = children(tree).find(n => n.props?.testID === 'turning-paper-leaf');
  assert.ok(leaf, 'turn surface covers the whole leaf');
  const onLeaf = children(leaf);
  assert.ok(onLeaf.some(n => typeof n.type === 'function' && n.type.name === 'PaperTexture'));
  assert.ok(onLeaf.some(n => n.props?.children === 'Page 2 of 3'), 'reverse face holds the next left text page');
  assert.ok(onLeaf.some(n => typeof n.type === 'function' && n.type.name === 'Header'));
  assert.ok(onLeaf.some(n => n.props?.children === 'Page 1 of 3'));
  assert.ok(onLeaf.some(n => n.props?.accessibilityLabel === 'Next journal page'));
  assert.ok(onLeaf.some(n => n.props?.selectable));
  finish({ finished: true }); tree = await hooks.flush();
  assert.ok(children(tree).some(n => n.props?.children === 'Page 2 of 3'));
  assert.ok(children(tree).some(n => n.props?.children === 'Page 3 of 3'));
  button('Previous journal page').props.onPress(); tree = await hooks.flush();
  assert.ok(ranges.some(r => r[0] === '-180deg' && r[1] === '0deg'));
  finish({ finished: true }); tree = await hooks.flush();
  assert.ok(children(tree).some(n => n.props?.children === 'Page 1 of 3'));
});


test('one through four text pages compose physical spreads and reverse exactly', async () => {
  for (const count of [1, 2, 3, 4]) {
    const hooks = hookHarness();
    let intro;
    const load = loadPlantingModules(undefined, hooks.react, undefined, true, {
      'react-native': { AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'web' }, Animated: { Value: class { interpolate() { return 0; } stopAnimation() {} } }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } },
      'react/jsx-runtime': { jsx, jsxs: jsx },
    });
    const { MeasuredPages, composeSpreads } = load('../../bookhouse/JournalPages');
    const expected = [{ left: 'intro', right: 0 }];
    if (count >= 2) expected.push({ left: 1, right: count >= 3 ? 2 : null });
    if (count === 4) expected.push({ left: 3, right: null });
    assert.deepEqual(JSON.parse(JSON.stringify(composeSpreads(count))), expected);
    const onIntroChange = value => { intro = value; };
    let tree = hooks.mount(() => MeasuredPages({ text: 'x'.repeat(count * 100), width: 180, height: 102, textStyle: {}, paper, onIntroChange }));
    for (let i = 0; i < 100; i++) {
      const probe = children(tree).find(n => n.props?.onLayout);
      if (!probe) break;
      probe.props.onLayout({ nativeEvent: { layout: { height: Math.ceil(probe.props.children.length / 20) * 20 } } });
      tree = await hooks.flush();
    }
    const check = index => {
      const expectedPages = [expected[index].left, expected[index].right].filter(x => typeof x === 'number').map(x => `Page ${x + 1} of ${count}`);
      const labels = children(tree).map(n => n.props?.children).filter(x => typeof x === 'string' && /^Page \d+ of/.test(x));
      assert.deepEqual(labels, expectedPages);
      assert.equal(intro, index === 0);
      if (expected[index].right === null) {
        const right = children(tree).find(n => n.props?.testID === 'journal-right-page');
        assert.equal(children(right).filter(n => n.props?.selectable).length, 0, 'last right leaf is blank');
      }
    };
    check(0);
    for (let i = 1; i < expected.length; i++) {
      children(tree).find(n => n.props?.accessibilityLabel === 'Next journal page').props.onPress(); tree = await hooks.flush(); check(i);
    }
    for (let i = expected.length - 2; i >= 0; i--) {
      children(tree).find(n => n.props?.accessibilityLabel === 'Previous journal page').props.onPress(); tree = await hooks.flush(); check(i);
    }
  }
});
