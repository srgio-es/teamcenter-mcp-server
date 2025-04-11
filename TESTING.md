# Testing and CI for Teamcenter MCP Server

This document describes the testing setup and continuous integration (CI) configuration for the Teamcenter MCP Server project.

## Testing Setup

The project uses Jest as the testing framework for both the main server and the teamcenter-client library. Tests are written in TypeScript and run with the Node.js ESM support.

### Test Structure

- **Main Server Tests**: Located in the `__tests__` directory at the project root
- **Client Library Tests**: Located in the `teamcenter-client/__tests__` directory

### Running Tests

To run tests for the main server:

```bash
npm test
```

To run tests for the client library:

```bash
cd teamcenter-client && npm test
```

To run tests with coverage reports:

```bash
npm run test:coverage
```

```bash
cd teamcenter-client && npm run test:coverage
```

### Test Environment

Tests run in a mock mode by default, which means they don't require a real Teamcenter instance. The mock mode is enabled by setting the `MOCK_MODE` environment variable to `true`.

## Linting

The project uses ESLint with TypeScript support to ensure code quality. The linting rules are defined in the `.eslintrc.js` files in both the main project and the client library.

To run linting for the main server:

```bash
npm run lint
```

To run linting for the client library:

```bash
cd teamcenter-client && npm run lint
```

To automatically fix linting issues:

```bash
npm run lint:fix
```

```bash
cd teamcenter-client && npm run lint:fix
```

## Continuous Integration

The project uses GitHub Actions for continuous integration. The CI workflow is defined in the `.github/workflows/ci.yml` file.

### CI Workflow

The CI workflow runs on every push to the `main` branch and on every pull request. It performs the following steps:

1. Checkout the code
2. Set up Node.js (testing on multiple Node.js versions)
3. Install dependencies for both the main server and the client library
4. Run linting for both the main server and the client library
5. Build the project
6. Run tests for both the main server and the client library
7. Upload coverage reports to Codecov

### CI Environment

The CI environment runs with `MOCK_MODE=true` to avoid the need for a real Teamcenter instance during testing.

## Adding New Tests

When adding new functionality, it's important to add corresponding tests. Here are some guidelines:

1. Create test files with the `.test.ts` extension in the appropriate `__tests__` directory
2. Use the Jest testing framework with the `@jest/globals` imports
3. Mock external dependencies to isolate the code being tested
4. Test both success and error cases
5. Aim for high test coverage, especially for critical functionality

## Code Coverage

The project uses Jest's built-in coverage reporting. Coverage reports are generated when running tests with the `--coverage` flag.

To view the coverage report, open the `coverage/lcov-report/index.html` file in a browser after running the tests with coverage.

## Best Practices

1. **Write Tests First**: Consider writing tests before implementing new features (Test-Driven Development)
2. **Keep Tests Focused**: Each test should focus on a specific piece of functionality
3. **Mock External Dependencies**: Use Jest's mocking capabilities to isolate the code being tested
4. **Test Error Cases**: Make sure to test error handling and edge cases
5. **Maintain Test Independence**: Tests should not depend on each other or on external state
6. **Keep Tests Fast**: Tests should run quickly to provide fast feedback
7. **Use Descriptive Test Names**: Test names should clearly describe what is being tested
