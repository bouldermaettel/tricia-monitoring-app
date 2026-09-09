<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read specs/001-monitoring-tool/plan.md.

<!-- SPECKIT END -->

## Graphify

This repository uses Graphify as the primary source for codebase navigation and architectural context.

### Mandatory first step

For every task that requires understanding the codebase, architecture, dependencies,
or relationships between files, classes, functions, modules, or components:

1. If `graphify-out/graph.json` exists, first run:

   `graphify query "<user question>"`

2. Use the returned scoped subgraph to identify the relevant source files.

3. Only then inspect source files as necessary.

Do not start with repository-wide search, grep, or broad source browsing when
Graphify is available.

Use:

* `graphify query "<question>"` for normal codebase questions
* `graphify path "<A>" "<B>"` for relationships between components
* `graphify explain "<concept>"` for focused concepts

If `graphify-out/wiki/index.md` exists, use it for broad architectural navigation.

Read `graphify-out/GRAPH_REPORT.md` only for broad architecture reviews or when
`query`, `path`, or `explain` do not provide enough context.

Dirty files inside `graphify-out/` are expected after hooks or incremental updates
and are not a reason to skip Graphify.

Only skip Graphify when:

* the user explicitly asks not to use it, or
* the task concerns stale, incorrect, or broken Graphify output.

### After code changes

After modifying code, run:

`graphify update .`

This is AST-only and does not incur API cost.

### /graphify

When the user types `/graphify`, use the installed Graphify skill or Graphify
instructions before doing anything else.

### Production deployments

Always ask for explicit confirmation before deploying to PROD:

"Do you really want to deploy to PROD? Changes may be breaking!"
