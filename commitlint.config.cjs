// Conventional Commits, checked on every commit by the husky hook. The type decides the release:
// feat -> minor, fix/perf -> patch, a "BREAKING CHANGE:" footer or "!" after the type -> major.
// Everything else (docs, chore, refactor, test, ci, build, style, revert) records but releases nothing on its own.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Commit bodies here are prose paragraphs; the default 100-column line limit fights them for no gain.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    'header-max-length': [2, 'always', 100],
  },
};
