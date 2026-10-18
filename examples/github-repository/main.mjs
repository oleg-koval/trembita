import { createTrembita, validateStandardSchema } from 'trembita';

const repository = process.argv[2] ?? 'oleg-koval/trembita';
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  console.error('Usage: npm run example:github -- owner/repository');
  process.exit(2);
}

const schema = {
  '~standard': {
    version: 1,
    vendor: 'github-repository-example',
    validate(value) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof value.full_name === 'string' &&
        typeof value.html_url === 'string' &&
        typeof value.stargazers_count === 'number' &&
        typeof value.open_issues_count === 'number'
      ) {
        return { value };
      }
      return {
        issues: [
          { message: 'GitHub response is missing expected repository fields' }
        ]
      };
    }
  }
};

const created = createTrembita({ endpoint: 'https://api.github.com' });
if (!created.ok) {
  console.error('Could not initialize Trembita:', created.error);
  process.exit(1);
}

const response = await created.value.request({
  path: `/repos/${repository}`,
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'trembita-real-api-example'
  }
});
if (!response.ok) {
  console.error('GitHub API request failed:', response.error);
  process.exit(1);
}

const validated = await validateStandardSchema(response.value, schema);
if (!validated.ok) {
  console.error('GitHub response validation failed:', validated.error);
  process.exit(1);
}

console.log(
  `${validated.value.full_name} — ${validated.value.stargazers_count} stars, ` +
    `${validated.value.open_issues_count} open issues\n${validated.value.html_url}`
);
