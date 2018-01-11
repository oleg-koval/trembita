const { danger, warn, fail } = require('danger');
const fs = require('fs');

// The Danger DSL can be a bit verbose, so let's rename
const modified = danger.git.modified_files;
const commits = danger.git.commits;

const mdTableGen = (headers, rows) => {

  const headerStr = `|${headers.join('|')}|`;
  const temp = [];

  for(let i = 0; i < headers.length; i++) {
    temp.push('---');
  }

  const splitterStr = `|${temp.join('|')}|`;

  const rowStr = rows.map(row => {
    return `|${row.join('|')}|`;
  }).join('\n');

  return `${headerStr}\n${splitterStr}\n${rowStr}\n`;
};
// No PR is too small to include a description of why you made a change

if (danger.github.pr.body.length < 10) {
  warn('Please include a description of your PR changes.');
}

// Check test exclusion (.only) is included
const modifiedTestFiles = modified.filter(filePath => {
  return filePath.match(/test\/.+?\.(js|jsx|ts|tsx)$/);
});

const testFilesIncludeExclusion = modifiedTestFiles.reduce((acc, filePath) => {
  const content = fs.readFileSync(filePath).toString();
  const invalid = content.match(/it.only|describe.only/);
  if (invalid) {
    acc.push(filePath);
  }
  return acc;
}, []);

if (testFilesIncludeExclusion.length > 0) {
  fail(`An \`only\` was left in tests (${testFilesIncludeExclusion})`);
}

// Validate if commit message in PR conforms conventional change log, notify if it doesn't
const invalidCommits = commits.reduce((acc, commit) => {
  const invalid = !commit.message.match(/(breaking|build|ci|chore|docs|feat|fix|other|perf|refactor|revert|style|test)\:\s(.+)/);
  if (invalid) {
    // acc.push(`| ${commit.sha.substr(0, 7)} | ${commit.message} |\n`);
    acc.push([
      commit.sha.substr(0, 7),
      commit.message
    ]);
  }
  return acc;
}, []);

if (invalidCommits.length > 0) {
  warn(`There are invalid Commits: \n\n${mdTableGen(['sha', 'commit'], invalidCommits)}`);
}

