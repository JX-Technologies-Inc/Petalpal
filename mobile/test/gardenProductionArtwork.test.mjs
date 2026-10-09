import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Execute the actual scene JSX gates: component doubles avoid loading native
// graphics, accounts or storage while preserving conditions and draw order.
const source = fs.readFileSync(new URL('../src/components/garden/GardenScene.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('GardenScene.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const approved = ['GardenLand09InterfaceLayer', 'GardenInfrastructureLayer', 'GardenRoadApproachLayer'];
const targets = [...approved, 'GardenBridge'];
const gates = [];
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && targets.includes(node.tagName.getText(tree))) {
    let parent = node.parent;
    while (parent && !ts.isJsxExpression(parent)) parent = parent.parent;
    assert.ok(parent?.expression, 'Artwork must have an executable scene expression');
    gates.push(parent.expression.getText(tree));
  }
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(gates.length, targets.length);
const output = ts.transpileModule('[' + gates.join(',') + ']', {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
function visible(development, infrastructureEnabled = true, showLandmarks = true) {
  return Array.from(vm.runInNewContext(output, {
    __DEV__: development, infrastructureEnabled, showLandmarks, bridgePlacement: {},
    ...Object.fromEntries(targets.map(name => [name, name])),
    React: { createElement: type => type },
  })).filter(Boolean);
}
test('release and development both render approved infrastructure in the same order', () => {
  assert.deepEqual(visible(false), approved);
  assert.deepEqual(visible(true), approved);
});
test('hidden landmarks suppress only the foreground road approach', () => {
  for (const development of [false, true])
    assert.deepEqual(visible(development, true, false), approved.slice(0, 2));
});
test('legacy infrastructure-off fallback remains development-only', () => {
  assert.deepEqual(visible(true, false), ['GardenBridge']);
  assert.deepEqual(visible(false, false), []);
});
