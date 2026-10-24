# GitHub Pages preview and publication

## Current deployment state

The source repository is public, and GitHub Pages is **enabled** with the
legacy branch source `gh-pages`. The live URL is
<https://silver-labs-technology-development.github.io/SilverForge-Studio/>.
The latest verified Pages build used `gh-pages` commit `6b27ea4` and returned
HTTP 200.

This conflicts with the earlier policy that Pages publishing was disabled
pending explicit owner approval. No approval record was found. The owner must
decide whether to keep the preview or disable it. The source
`.github/workflows/ci.yml` workflow only runs tests and builds the artifact; it
does not deploy. The `gh-pages` branch contains a checked-in build and tracked
`node_modules`, which is not a reviewed deployment workflow.

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

## Required owner decision

An authorized maintainer must confirm whether the current public preview is
approved. If it is kept, replace the legacy `gh-pages` branch source with a
reviewed workflow that deploys the `dist/` output. Use the `github-pages`
environment with an owner-configured required reviewer if the organization
supports that protection. Grant only the minimum Pages write and OIDC
deployment permissions. Do not add provider keys, storage credentials, or any
other secret to Vite variables, generated files, Actions artifacts, or Pages
output. If it is not approved, disable Pages and remove the published branch
only after preserving any needed artifact.

Before retaining or replacing the preview, review package licenses, run the
full CI workflow, verify the build at the actual repository base path, inspect
dependency provenance, and confirm that the source/public-preview relationship
is approved. Public Pages output can disclose every bundled frontend file even
if the source repository later becomes private.
