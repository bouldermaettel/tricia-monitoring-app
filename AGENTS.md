# AGENTS.md

## Project guidance

Before making changes, follow the project's existing architecture, conventions, and tooling.

For additional project-specific context such as technologies, structure, shell commands, and implementation details, consult the relevant files under `specs/` when available.

---

## Graphify

This repository uses Graphify as the primary source for codebase navigation and architectural context.

### Mandatory first step for codebase understanding

For every task or question that requires understanding the codebase, architecture, dependencies, data flow, or relationships between files, classes, functions, modules, or components:

1. Check whether `graphify-out/graph.json` exists.

2. If it exists, first run:

   `graphify query "<user question>"`

3. Use the returned scoped subgraph to determine which files, symbols, or components are relevant.

4. Only then inspect the relevant source files as needed.

Do not start with repository-wide grep, broad source browsing, or large-scale file searches when Graphify is available.

### Graphify commands

Use:

* `graphify query "<question>"` for normal codebase questions
* `graphify path "<A>" "<B>"` to investigate relationships between components
* `graphify explain "<concept>"` for focused explanations of a concept, component, class, module, or subsystem

If `graphify-out/wiki/index.md` exists, prefer it for broad architectural navigation.

Read `graphify-out/GRAPH_REPORT.md` only:

* for broad architecture reviews, or
* when `query`, `path`, or `explain` do not provide enough context.

### Graph state

Dirty or modified files inside `graphify-out/` are expected after hooks or incremental updates.

Dirty Graphify output is not a reason to skip Graphify.

Only skip Graphify when:

* the user explicitly asks not to use it, or
* the task is specifically about stale, incorrect, broken, or outdated Graphify output.

### After modifying code

After code changes, run:

`graphify update .`

This update is AST-only and should be used to keep the graph synchronized with the repository.

### `/graphify`

When the user explicitly types `/graphify`, use the installed Graphify skill, command, or Graphify-specific instructions before doing anything else.

---

## Source inspection

Use Graphify to narrow the scope first.

After Graphify identifies relevant files or symbols:

* inspect only the source files necessary for the task
* prefer targeted searches over repository-wide scans
* avoid reading large unrelated parts of the repository
* verify important assumptions against the actual implementation

If Graphify and the source code disagree, treat the source code as authoritative and note that the graph may need updating.

---

## Code changes

When modifying code:

* preserve existing project conventions
* avoid unrelated refactoring
* keep changes scoped to the requested task
* update tests when behavior changes
* run relevant tests, checks, or linters where available
* inspect failures before making additional changes
* update Graphify afterwards with `graphify update .`

---

## Production safety

Never deploy to PROD without explicit user confirmation.

Before any production deployment, ask:

"Do you really want to deploy to PROD? Changes may be breaking!"

Do not interpret earlier discussion, planning, or approval of code changes as approval to deploy to production.
