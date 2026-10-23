# GitHub Pages preview and publication

## Current deployment state

**Pages publishing is disabled pending explicit owner approval.** This
standalone source tree has not yet been connected to an organization
repository, so repository visibility and Pages settings are not available to
inspect or change. There is no Pages deployment workflow. The
`.github/workflows/ci.yml` source workflow only runs tests and builds the
artifact.

## Local project-path preview

Vite uses relative asset URLs, so the build can run beneath a GitHub Pages
project path without rewriting application routes:

```sh
npm ci
npm test
npm run build
npm run preview
```

To test an explicit repository path:

```sh
VITE_BASE_PATH=/SilverForge-Studio/ npm run build
```

The built `dist/` directory is the static site artifact. No API server or
database is included.

## After publication is separately approved

An authorized maintainer must confirm the repository owner, approved
visibility, Pages plan and source repository, then propose a separate reviewed
workflow that deploys the `dist/` output. Use the `github-pages` environment
with an owner-configured required reviewer if the organization supports that
protection. Grant only the minimum Pages write and OIDC deployment
permissions. Do not add provider keys, storage credentials, or any other
secret to Vite variables, generated files, Actions artifacts, or Pages output.

Before the first public deployment, review package licenses, run the full CI
workflow, verify the build at the actual repository base path, inspect
dependency provenance, and confirm that the source/public-preview relationship
is approved. Public Pages output can disclose every bundled frontend file
even if the source repository is private.
