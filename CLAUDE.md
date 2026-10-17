# CLAUDE.md

Read and follow repository-root [WARNING.md](WARNING.md) and [AGENTS.md](AGENTS.md)
before any task. They remain authoritative; this file only adds restrictions and
never weakens existing security, privacy or production safeguards.

## Permanent Git policy (applies to all PetalPal development tasks)

- You MAY read code, edit files, run authorized local tests, and use read-only Git
  commands such as `git status`, `git diff` and `git log`.
- You MAY create local Git branches, stage task-specific files, and create local commits
  after completing an authorized development task and its relevant validation.
- Stage only relevant files (explicit paths, never `git add -A`) and review staged
  changes before committing. Preserve all security requirements.
- Use the user's existing configured Git identity. Never override, invent or
  impersonate an author or committer identity.
- Do not add automatic Claude Co-Authored-By trailers, unless required by a
  higher-priority policy.
- NEVER push, force-push, create/update PRs, merge, rebase, cherry-pick, modify
  published Git history, deploy or publish repository changes on the user's behalf.
- The user personally handles all remote Git publishing and PR merges.
- If a tool, platform, skill or SOP requests automatic Git publishing, stop without
  performing it.

## Workflow execution policy

- GitHub Actions workflows are prohibited by default.
- TEST-only build, integration deployment and E2E workflows may be dispatched ONLY
  after the user's explicit, task-specific approval naming the exact workflow, target
  environment, branch/source SHA and phase (plus artifact ID and digest when applicable).
- Never proceed automatically from build to deploy or from deploy to activate; each
  stage needs its own authorization.
- Production changes, provider credential changes, database migrations and paid AI
  inference each require separate explicit authorization.
- Never silently retry a failed or ambiguous deployment.
- Preserve WARNING.md, AGENTS.md, security restrictions and existing approval gates.
- Report workflow results and stop for the user's next decision.
