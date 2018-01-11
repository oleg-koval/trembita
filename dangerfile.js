const { danger, warn, message, fail } = require('danger');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

//test
message(`:tada:, this worked @${danger.github.pr.user.login}!`)

// No PR is too small to include a description of why you made a change

if (danger.github.pr.body.length < 10) {
  warn('Please include a description of your PR changes.');
}

// Check test exclusion (.only) is included
const modifiedSpecFiles = danger.git.modified_files.filter(filePath => {
  return filePath.match(/\/test\/.+?\.(js|jsx|ts|tsx)$/gi);
});

const testFilesIncludeExclusion = modifiedSpecFiles.reduce((acc, value) => {
  const content = fs.readFileSync(value).toString();
  const invalid = _.includes(content, 'it.only') || _.includes(content, 'describe.only');
  if (invalid) {
    acc.push(path.basename(value));
  }
  return acc;
}, []);

if (testFilesIncludeExclusion.length > 0) {
  fail(`An \`only\` was left in tests (${testFilesIncludeExclusion})`);
}
