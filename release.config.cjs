// semantic-release. Releases are cut from commit messages on every push to main. Publishing to npm happens
// only when NPM_TOKEN is present in the release job; without it the release still tags, writes the changelog
// and publishes the GitHub notes, and `npx tekjobs` keeps serving the last published version.
const publish = !!process.env.NPM_TOKEN;
module.exports = {
  "branches": [
    "main"
  ],
  "tagFormat": "v${version}",
  "plugins": [
    [
      "@semantic-release/commit-analyzer",
      {
        "preset": "conventionalcommits",
        "releaseRules": [
          {
            "breaking": true,
            "release": "minor"
          }
        ]
      }
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        "preset": "conventionalcommits",
        "presetConfig": {
          "types": [
            {
              "type": "feat",
              "section": "Features"
            },
            {
              "type": "fix",
              "section": "Fixes"
            },
            {
              "type": "perf",
              "section": "Performance"
            },
            {
              "type": "revert",
              "section": "Reverts"
            },
            {
              "type": "docs",
              "section": "Docs",
              "hidden": false
            },
            {
              "type": "refactor",
              "section": "Refactoring",
              "hidden": true
            },
            {
              "type": "test",
              "hidden": true
            },
            {
              "type": "build",
              "hidden": true
            },
            {
              "type": "ci",
              "hidden": true
            },
            {
              "type": "chore",
              "hidden": true
            },
            {
              "type": "style",
              "hidden": true
            }
          ]
        }
      }
    ],
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md",
        "changelogTitle": "# Changelog\n\nEvery release, newest first. Written by semantic-release from the commit messages."
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": publish
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "CHANGELOG.md",
          "package.json",
          "package-lock.json"
        ],
        "message": "chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
};
