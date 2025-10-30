# Graph Pathfinding Tests

## Running the Tests

To run the pathfinding tests:

```bash
# Run all tests
pnpm test

# Run only pathfinding tests
pnpm test graph-pathfinding

# Run tests in watch mode
pnpm test graph-pathfinding --watch
```

## Test Structure

### `graph-pathfinding.test.ts`

This file contains comprehensive tests for the graph pathfinding feature:

#### Module Search Tests
Tests the ability to find modules by partial names:
- Exact display name matching
- Partial name matching
- Path segment matching
- Case-insensitive search

#### Pathfinding Tests
Tests the core DFS pathfinding algorithm:
- Single path finding
- Multiple path finding
- Handling non-existent nodes
- Same start/end node handling
- Circular dependency prevention

#### Integration Tests
Tests the complete workflow (search + pathfinding):
- Finding paths using partial file names
- Case-insensitive pathfinding
- Empty search result handling

## Test Data Structure

The tests use a mock module graph:

```
main.ts
├── App.vue
│   └── Header.vue
│       └── utils.ts
└── router.ts
    └── routes.ts
        └── utils.ts
```

This structure allows testing:
- Single paths (main.ts → Header.vue)
- Multiple paths (main.ts → utils.ts has 2 paths)
- Depth handling
- Search functionality

## Adding New Tests

To add new test cases:

1. Create mock modules using `createMockModule()`
2. Add them to `mockModulesMap` in `beforeEach()`
3. Write test cases using `it()` or `test()`
4. Use `expect()` assertions to verify behavior

Example:

```typescript
it('should find path in custom graph', () => {
  mockModulesMap.set('/custom/file.ts', createMockModule(
    '/custom/file.ts',
    'file.ts',
    ['/custom/dep.ts']
  ))
  
  const paths = findAllPaths('/custom/file.ts', '/custom/dep.ts', mockModulesMap)
  expect(paths).toHaveLength(1)
})
```

## Debugging Failed Tests

If tests fail:

1. Check the error message - it usually indicates which assertion failed
2. Add `console.log()` statements to inspect intermediate values
3. Run tests with `--reporter=verbose` for more details
4. Verify mock data structure matches your expectations

## Coverage

Current test coverage:
- ✅ Module search functionality
- ✅ Basic pathfinding (single/multiple paths)
- ✅ Edge cases (no path, same node, circular deps)
- ✅ Integration (search + pathfinding)
- ✅ Case sensitivity
