import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const TEST_RUNNER_CALLEES = new Set(['describe', 'test', 'it', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

describe('architecture', () => {
  describe('function structure', () => {
    test('uses declared functions without nesting or default parameters', () => {
      const projectDirectory = resolve(import.meta.dir, '..');
      const sourceFiles = new Bun.Glob('{src,scripts,tests}/**/*.ts');
      const violations: string[] = [];

      for (const filename of sourceFiles.scanSync(projectDirectory)) {
        const source = ts.createSourceFile(filename, readFileSync(resolve(projectDirectory, filename), 'utf8'), ts.ScriptTarget.Latest, true);
        inspectFunctionStructure(source, 0, violations);
      }

      expect(violations).toEqual([]);
    });
  });
});

function calleeRootName(callee: ts.Expression): string | null {
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return calleeRootName(callee.expression);
  if (ts.isCallExpression(callee)) return calleeRootName(callee.expression);

  return null;
}

function isTestRunnerCallback(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node)) return false;
  const call = node.parent;

  if (!ts.isCallExpression(call)) return false;
  const rootName = calleeRootName(call.expression);

  return rootName !== null && TEST_RUNNER_CALLEES.has(rootName);
}

function inspectFunctionStructure(node: ts.Node, functionDepth: number, violations: string[]): void {
  const isImplementation = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node);

  if (isImplementation && node.body && !isTestRunnerCallback(node)) {
    const source = node.getSourceFile();
    const location = source.getLineAndCharacterOfPosition(node.getStart());
    const label = `${source.fileName}:${location.line + 1}`;

    if (!ts.isFunctionDeclaration(node)) violations.push(`${label}: function declaration required`);
    if (functionDepth > 0) violations.push(`${label}: nested function`);
    for (const parameter of node.parameters) {
      if (parameter.initializer) violations.push(`${label}: default parameter`);
    }

    functionDepth += 1;
  }

  if (ts.isBindingElement(node) && node.initializer) {
    violations.push(`${node.getSourceFile().fileName}: default binding`);
  }

  for (const child of node.getChildren()) inspectFunctionStructure(child, functionDepth, violations);
}
