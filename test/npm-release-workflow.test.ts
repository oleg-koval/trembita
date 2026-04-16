import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const workflowPath = `${dirname}/../.github/workflows/npm-release.yml`;
const workflowContent = readFileSync(workflowPath, 'utf8');
const workflowLines = workflowContent.split('\n');

/**
 * Returns the 0-based line index of the first line matching the predicate,
 * or -1 if not found.
 */
function findLineIndex(predicate: (line: string) => boolean): number {
  return workflowLines.findIndex(predicate);
}

/**
 * Returns all 0-based line indices of lines matching the predicate.
 */
function findAllLineIndices(predicate: (line: string) => boolean): number[] {
  return workflowLines.reduce<number[]>((acc, line, idx) => {
    if (predicate(line)) acc.push(idx);
    return acc;
  }, []);
}

describe('npm-release.yml workflow', () => {
  describe('trigger configuration', () => {
    it('triggers on push to main branch', () => {
      expect(workflowContent).toMatch(/branches:\s*\n(\s*-\s*\S+\s*\n)*\s*-\s*main/);
    });

    it('triggers on push to beta branch', () => {
      expect(workflowContent).toMatch(/branches:\s*\n(\s*-\s*\S+\s*\n)*\s*-\s*beta/);
    });

    it('does not trigger on pull_request events', () => {
      expect(workflowContent).not.toContain('pull_request:');
    });
  });

  describe('permissions are scoped to the job level, not the workflow level', () => {
    it('has a permissions block', () => {
      expect(workflowContent).toContain('permissions:');
    });

    it('permissions block is NOT at the workflow top level (zero indentation)', () => {
      // A top-level permissions key would start at column 0, i.e. "permissions:" with no leading spaces.
      const topLevelPermissions = workflowLines.some(
        (line) => line === 'permissions:'
      );
      expect(topLevelPermissions).toBe(false);
    });

    it('permissions block appears inside the release job (indented at job-property level)', () => {
      // Job-property lines are indented with exactly 4 spaces in this workflow.
      const jobLevelPermissionsIdx = findLineIndex(
        (line) => line === '    permissions:'
      );
      expect(jobLevelPermissionsIdx).toBeGreaterThan(-1);
    });

    it('permissions: contents is write', () => {
      expect(workflowContent).toContain('contents: write');
    });

    it('permissions: issues is write', () => {
      expect(workflowContent).toContain('issues: write');
    });

    it('permissions: pull-requests is write', () => {
      expect(workflowContent).toContain('pull-requests: write');
    });

    it('permissions: id-token is write (required for OIDC Trusted Publishing)', () => {
      expect(workflowContent).toContain('id-token: write');
    });

    it('all four required permissions are present exactly once', () => {
      const requiredPermissions = [
        'contents: write',
        'issues: write',
        'pull-requests: write',
        'id-token: write'
      ];
      for (const permission of requiredPermissions) {
        const count = workflowContent.split(permission).length - 1;
        expect(count, `"${permission}" should appear exactly once`).toBe(1);
      }
    });
  });

  describe('setup-node: node-version', () => {
    it('uses Node.js 24', () => {
      expect(workflowContent).toContain("node-version: '24'");
    });

    it('does NOT use the old Node.js 22 version', () => {
      // Regression: the PR changed this from '22' to '24'.
      expect(workflowContent).not.toContain("node-version: '22'");
    });
  });

  describe('setup-node: registry-url conditional (NPM Trusted Publishing)', () => {
    it('registry-url is set conditionally based on NPM_TOKEN secret', () => {
      expect(workflowContent).toContain(
        "secrets.NPM_TOKEN != '' && 'https://registry.npmjs.org' || ''"
      );
    });

    it('registry-url resolves to npmjs registry when NPM_TOKEN is set', () => {
      // When NPM_TOKEN is non-empty the expression evaluates to the npm registry URL.
      expect(workflowContent).toContain('https://registry.npmjs.org');
    });

    it('registry-url falls back to empty string when NPM_TOKEN is absent', () => {
      // The trailing `|| ''` ensures an empty string (no registry) when NPM_TOKEN is unset,
      // enabling OIDC-only Trusted Publishing without a token.
      // The value is on the next line (YAML block scalar / multiline), so we check for the
      // full conditional string anywhere in the file.
      expect(workflowContent).toContain(
        "secrets.NPM_TOKEN != '' && 'https://registry.npmjs.org' || ''"
      );
    });

    it('registry-url expression uses GitHub Actions expression syntax', () => {
      expect(workflowContent).toMatch(/registry-url:\s*\$\{\{.*NPM_TOKEN/);
    });
  });

  describe('setup-node: always-auth conditional (NPM Trusted Publishing)', () => {
    it('always-auth is set conditionally based on NPM_TOKEN secret', () => {
      expect(workflowContent).toContain("always-auth: ${{ secrets.NPM_TOKEN != '' }}");
    });

    it('always-auth and registry-url use the same NPM_TOKEN condition', () => {
      // Both settings must check the same secret to stay in sync.
      // Skip comment lines (starting with #) when looking for the yaml config lines.
      const isYamlConfigLine = (l: string): boolean =>
        !l.trimStart().startsWith('#');

      const registryUrlLine = workflowLines.find(
        (l) => l.includes('registry-url') && isYamlConfigLine(l)
      );
      // registry-url value is on the next line; find the continuation line with the expression
      const registryUrlValueLine = workflowLines.find(
        (l) => l.includes("secrets.NPM_TOKEN != ''") && l.includes('registry.npmjs.org')
      );
      const alwaysAuthLine = workflowLines.find(
        (l) => l.includes('always-auth') && isYamlConfigLine(l)
      );

      // The registry-url yaml key line must be present (even if value is on next line)
      expect(registryUrlLine).toBeDefined();
      // Both the registry-url expression and always-auth reference secrets.NPM_TOKEN != ''
      expect(registryUrlValueLine).toContain("NPM_TOKEN != ''");
      expect(alwaysAuthLine).toContain("NPM_TOKEN != ''");
    });
  });

  describe('OIDC / Trusted Publishing comment block', () => {
    it('contains a reference to the Trusted Publishing gist', () => {
      expect(workflowContent).toContain(
        'https://gist.github.com/kettanaito/debde3cabfae4f68d37cf0f8f3a6a666'
      );
    });

    it('documents that Node 24+ is required for Trusted Publishing', () => {
      expect(workflowContent).toContain('Node 24+ is required');
    });

    it('documents the NPM_TOKEN bootstrap flow', () => {
      expect(workflowContent).toContain('NPM_TOKEN');
    });

    it('references the OIDC-only fallback instructions (steps 12–14 of the gist)', () => {
      expect(workflowContent).toContain('OIDC only');
    });
  });

  describe('release job configuration', () => {
    it('job runs on ubuntu-latest', () => {
      expect(workflowContent).toContain('runs-on: ubuntu-latest');
    });

    it('uses actions/checkout@v4', () => {
      expect(workflowContent).toContain('uses: actions/checkout@v4');
    });

    it('checkout sets fetch-depth to 0 (full history for semantic-release)', () => {
      expect(workflowContent).toContain('fetch-depth: 0');
    });

    it('checkout sets persist-credentials to false (OIDC security requirement)', () => {
      expect(workflowContent).toContain('persist-credentials: false');
    });

    it('uses actions/setup-node@v4', () => {
      expect(workflowContent).toContain('uses: actions/setup-node@v4');
    });

    it('enables npm cache', () => {
      expect(workflowContent).toContain('cache: npm');
    });

    it('runs npm ci with --no-audit for reproducible installs', () => {
      expect(workflowContent).toContain('npm ci --no-audit');
    });

    it('runs npm audit as a separate step', () => {
      expect(workflowContent).toContain('run: npm audit');
    });

    it('runs npm run build before release', () => {
      expect(workflowContent).toContain('run: npm run build');
    });

    it('runs npm test before release', () => {
      expect(workflowContent).toContain('run: npm test');
    });

    it('runs semantic-release via npx', () => {
      expect(workflowContent).toContain('npx semantic-release');
    });

    it('sets NPM_CONFIG_PROVENANCE to true for supply-chain transparency', () => {
      expect(workflowContent).toContain("NPM_CONFIG_PROVENANCE: 'true'");
    });

    it('passes GITHUB_TOKEN to semantic-release step', () => {
      expect(workflowContent).toContain(
        'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}'
      );
    });

    it('passes NPM_TOKEN to semantic-release step', () => {
      expect(workflowContent).toContain('NPM_TOKEN: ${{ secrets.NPM_TOKEN }}');
    });
  });

  describe('structural integrity', () => {
    it('workflow file is non-empty', () => {
      expect(workflowContent.trim().length).toBeGreaterThan(0);
    });

    it('workflow is named "Release to NPM"', () => {
      expect(workflowContent).toContain('name: Release to NPM');
    });

    it('defines exactly one job named "release"', () => {
      // Verify "release:" is indented at the jobs child level (2 spaces).
      const releaseJobLines = findAllLineIndices(
        (line) => line === '  release:'
      );
      expect(releaseJobLines).toHaveLength(1);
    });

    it('permissions appear after "runs-on" and before "steps" within the release job', () => {
      const runsOnIdx = findLineIndex((l) => l.includes('runs-on:'));
      const permissionsIdx = findLineIndex((l) => l === '    permissions:');
      const stepsIdx = findLineIndex((l) => l === '    steps:');

      expect(runsOnIdx).toBeGreaterThan(-1);
      expect(permissionsIdx).toBeGreaterThan(-1);
      expect(stepsIdx).toBeGreaterThan(-1);

      expect(permissionsIdx).toBeGreaterThan(runsOnIdx);
      expect(stepsIdx).toBeGreaterThan(permissionsIdx);
    });

    it('build step runs before test step', () => {
      const buildIdx = findLineIndex((l) => l.includes('npm run build'));
      const testIdx = findLineIndex((l) => /run: npm test/.test(l));
      expect(buildIdx).toBeGreaterThan(-1);
      expect(testIdx).toBeGreaterThan(-1);
      expect(testIdx).toBeGreaterThan(buildIdx);
    });

    it('test step runs before semantic-release step', () => {
      const testIdx = findLineIndex((l) => /run: npm test/.test(l));
      const releaseIdx = findLineIndex((l) => l.includes('npx semantic-release'));
      expect(testIdx).toBeGreaterThan(-1);
      expect(releaseIdx).toBeGreaterThan(-1);
      expect(releaseIdx).toBeGreaterThan(testIdx);
    });
  });
});