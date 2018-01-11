const { danger, warn, fail } = require('danger');
const fs = require('fs');

// The Danger DSL can be a bit verbose, so let's rename
const modified = danger.git.modified_files

// No PR is too small to include a description of why you made a change

if (danger.github.pr.body.length < 10) {
  warn('Please include a description of your PR changes.');
}

// Check test exclusion (.only) is included
const modifiedTestFiles = modified.filter(filePath => {
  return filePath.match(/test\/.+?\.(js|jsx|ts|tsx)$/);
});

const testFilesIncludeExclusion = modifiedTestFiles.reduce((acc, value) => {
  const content = fs.readFileSync(value).toString();
  const invalid = content.match(/it.only|describe.only/);
  if (invalid) {
    acc.push(value);
  }
  return acc;
}, []);

if (testFilesIncludeExclusion.length > 0) {
  fail(`An \`only\` was left in tests (${testFilesIncludeExclusion})`);
}
