import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const TEST_RUNNER_CALLEES = new Set(['describe', 'test', 'it', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll']);

const SINGLE_EXPORT_EXCEPTIONS = new Set(['src/index.ts', 'src/types.ts', 'src/cli/child.ts']);

describe('architecture', () => {
  describe('module exports', () => {
    test('every source module exposes one default export and no named runtime exports', () => {
      const projectDirectory = resolve(import.meta.dir, '..');
      const sourceFiles = new Bun.Glob('src/**/*.ts');
      const violations: string[] = [];

      for (const filename of sourceFiles.scanSync(projectDirectory)) {
        if (SINGLE_EXPORT_EXCEPTIONS.has(filename)) continue;

        const source = ts.createSourceFile(filename, readFileSync(resolve(projectDirectory, filename), 'utf8'), ts.ScriptTarget.Latest, true);

        let defaultExports = 0;

        for (const statement of source.statements) {
          if (ts.isExportAssignment(statement)) {
            defaultExports += 1;
            continue;
          }

          if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
            violations.push(`${filename}: named runtime export`);
            continue;
          }

          if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;

          const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) ?? [] : [];

          for (const modifier of modifiers) {
            if (modifier.kind === ts.SyntaxKind.ExportKeyword) violations.push(`${filename}: named runtime export`);
          }
        }

        if (defaultExports !== 1) violations.push(`${filename}: ${defaultExports} default exports, expected 1`);
      }

      expect(violations).toEqual([]);
    });
  });

  describe('function structure', () => {
    test('uses object methods without arrow functions or default parameters', () => {
      const projectDirectory = resolve(import.meta.dir, '..');
      const sourceFiles = new Bun.Glob('{src,scripts,tests}/**/*.ts');
      const violations: string[] = [];

      for (const filename of sourceFiles.scanSync(projectDirectory)) {
        const source = ts.createSourceFile(filename, readFileSync(resolve(projectDirectory, filename), 'utf8'), ts.ScriptTarget.Latest, true);

        inspectFunctionStructure(source, violations);
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

function inspectFunctionStructure(node: ts.Node, violations: string[]): void {
  const isImplementation = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node);

  if (isImplementation && node.body && !isTestRunnerCallback(node)) {
    const source = node.getSourceFile();
    const location = source.getLineAndCharacterOfPosition(node.getStart());
    const label = `${source.fileName}:${location.line + 1}`;

    if (ts.isArrowFunction(node)) violations.push(`${label}: arrow function`);

    for (const parameter of node.parameters) {
      if (parameter.initializer) violations.push(`${label}: default parameter`);
    }
  }

  if (ts.isBindingElement(node) && node.initializer) {
    violations.push(`${node.getSourceFile().fileName}: default binding`);
  }

  for (const child of node.getChildren()) inspectFunctionStructure(child, violations);
}
