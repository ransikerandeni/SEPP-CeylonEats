# Working as a group

## Branches and commits

Keep `main` runnable. Use short-lived branches, for example `feature/review-filters`, `fix/menu-price-validation` or `docs/test-evidence`. Commit a coherent change with an informative message:

```sh
git switch -c feature/your-change
npm run format
npm run build
npm test
git add <specific-files>
git commit -m "feat: describe the user-visible result"
```

Use `feat:`, `fix:`, `test:`, `docs:` or `chore:` as useful prefixes. Avoid committing unrelated work together. Request a teammate review before merging into `main`; do not commit directly to a shared `main` after the initial prototype setup.

## Before proposing a merge

- Explain the problem and final behaviour, with screenshots for meaningful UI changes.
- Include relevant test results. Test both a permitted and a rejected path for permission changes.
- Check `git diff --check` and `npm run format:check`.
- Run `npm run build` and `npm test` with the local PostgreSQL server running.
- Check desktop and mobile layouts when changing forms, navigation or filters.
- Update the specification/test matrix when changing a business rule.

Use parameterized SQL. Validate API input on the server. Never trust client-supplied roles, review status or calculated rating/price fields. Keep new database schema changes versioned; extend the migration runner for a new numbered SQL migration instead of changing an already-deployed migration.

## Secrets and data

Never commit `.env`, `.local/ACCESS.md`, database data, logs, private images or real customer information. `.env.example` contains configuration names and local-only defaults. Seed data is fictional and for development only.

## Add a shared remote

Create a repository with your preferred provider, then use its actual URL:

```sh
git remote add origin <your-repository-url>
git push -u origin main
```

Do not replace an existing remote without checking with the group. Once a remote is configured, use pull requests and enable branch protection where available. Local commits already preserve the implementation history; remote collaboration is the group's next setup step.
