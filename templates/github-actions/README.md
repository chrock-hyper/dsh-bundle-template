# Optional GitHub Actions

The template does not ship an active workflow. To enable CI, copy `ci.yml` to
`.github/workflows/ci.yml` from the repository root and commit it:

```sh
mkdir -p .github/workflows
cp templates/github-actions/ci.yml .github/workflows/ci.yml
```

The workflow runs `pnpm typecheck`, `pnpm build`, and `pnpm pack:check`. It
installs with `--ignore-scripts`, so the explicit build step owns build
failures.

No publish workflow is included. Publishing the plugin packages and the bundle
is a manual release step; see the root README.
