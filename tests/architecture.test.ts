import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

test('las implementaciones usan funciones declaradas sin anidación ni parámetros por defecto', checkFunctionStructure);

function checkFunctionStructure(): void {
  const projectDirectory = resolve(import.meta.dir, '..');
  const sourceFiles = new Bun.Glob('{src,scripts,tests}/**/*.ts');
  const violations: string[] = [];
  for (const filename of sourceFiles.scanSync(projectDirectory)) {
    const source = ts.createSourceFile(filename, readFileSync(resolve(projectDirectory, filename), 'utf8'), ts.ScriptTarget.Latest, true);
    inspectFunctionStructure(source, 0, violations);
  }
  expect(violations).toEqual([]);
}

function inspectFunctionStructure(node: ts.Node, functionDepth: number, violations: string[]): void {
  const isImplementation = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node);
  if (isImplementation && node.body) {
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
