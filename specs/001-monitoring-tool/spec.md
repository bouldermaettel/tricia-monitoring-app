# Feature Specification: Monitoring Tool

**Source**: Patrick's notes (Monitoring App Notes Patrick.md) + initial technical specification  
**Last updated**: 2026-04-23

## Summary
Build a monitoring application for tracking classification quality over time, validating individual cases, and analyzing confusion matrices across operational and control workflows. The tool serves two distinct populations: operational staff (WiMi) who enter and validate cases, and monitoring/control roles who analyze quality and oversee task completion.

## Goals
- Capture and validate case-level classification inputs with minimal friction for WiMi.
- Analyze confusion matrices over configurable rolling time windows, showing acceptance thresholds alongside actual metrics.
- Support case review workflows with comments, exclusion flags, category assignment, and review status.
- Provide oversight views for verifying whether WiMi completed their entries on time.
- Import datasets from a predefined base file or an uploaded alternative.
- Export filtered views as CSV and Excel from analysis and control dashboards.
- Centralize acceptance thresholds in one configurable location.
- Generate printable/downloadable reports of analysis and control views (nice-to-have).

## Actors
- **WiMi (operational user)**: enters and validates individual cases; the only actor who uses the input dashboard.
- **Analyst/monitoring user**: inspects confusion matrices, filters cases, annotates, exports results.
- **Control/oversight user**: verifies whether WiMi completed entries within expected timeframes.
- **Administrator**: configures acceptance thresholds and manages the base dataset.

## Functional Requirements

### Input Dashboard (WiMi)
- Capture `vk_number`, `device_name`, `tricia_s`, `tricia_p`, `tricia_d`, `user_s`, and `user_d`.
- Provide a **Validate** action: when the WiMi makes no corrections, `user_s` and `user_d` are automatically copied from the corresponding Tricia values — the WiMi should not need to re-enter unchanged values.
- Provide a **Save** action that finalizes and persists the record after validation.
- Detect duplicate `vk_number` values and show a dialog offering: edit the existing entry or cancel input.
- Auto-capture `input_timestamp`, derive `analysis_date` from `vk_number`, and infer `user_id` automatically where possible; fall back to a manual user identification field.
- Optimize the form flow for rapid repetitive entry by WiMi who process many cases with low variance.

### Matrix Dashboard (Analysis and Monitoring)
- Show a confusion matrix for the selected period and all cases in that period as a table alongside it.
- Support predefined time windows: last 3 months, last 6 months, last 12 months, and all time since tool introduction.
- Support a custom date range input for ad hoc periods.
- Control the active period through a dropdown: `[3M | 6M | 12M | ALL | CUSTOM]`.
- All calculations use `analysis_date` (derived from `vk_number`), not `input_timestamp`.
- Display acceptance threshold values alongside the actual computed metrics at each confusion matrix cell.
- Color-code matrix cells: green when within acceptance criteria, red when outside.
- Clicking a matrix cell isolates the cases belonging to that cell in the case table.
- Case table columns: `device_name`, `tricia_s`, `user_s` (WiMi S), `tricia_d`, `user_d` (WiMi D), `category`, `comment`, exclusion flag (Streichresultat), reviewed flag.
- Toggle between: all cases / only problematic cases (deviation ≥ 2 between WiMi and Tricia in any dimension).
- Toggle: include or exclude Streichresultate (excluded cases) in matrix calculations and case list.
- Optional risk filter: false low classifications (high risk), false high classifications (low risk), all misclassifications.
- Per-row actions: mark as reviewed, add comment, toggle exclusion (Streichresultat), assign category.
- Category values: `no_issue` (Kein Problem), `monitor` (Zur Beobachtung), `problem` (Problem).
- Color-code case rows: green when deviation ≤ 1 (within acceptance), red when deviation > 1.
- Differentiate red rows further by risk direction: false low (high risk) vs false high (low risk) (nice-to-have).
- Accept thresholds should be centrally configurable by an administrator; the spec does not prescribe whether this is a settings UI or a config file — this is an open decision for the admin UX phase.

### Control Dashboard (Task Oversight)
- Show a list of entries for a user-selected time period.
- Columns: `vk_number`, `analysis_date` (Vk-based date), `input_timestamp`, `user_id` (WiMi).
- Allow filtering by date range.
- Identify missing or delayed entries so the control role can verify WiMi task completion.

### Data Handling

#### Base Dataset and Import
- The system uses a predefined base dataset as its starting point (loaded at setup time or via admin upload).
- A WiMi or administrator can upload an alternative CSV or Excel file to replace or supplement the base dataset.
- Imported rows are validated against the same rules as manual input.

#### Export
- Export the currently filtered case list as CSV or Excel from the matrix dashboard and control dashboard.
- Report generation for the current analysis or control view is a nice-to-have (not required for the initial version).

## Key Rules
- `deviation = abs(user_value - tricia_value)` (applied independently to S and D dimensions)
- `is_problem = deviation >= 2`
- `is_acceptable = deviation <= configured_threshold` (threshold is centrally managed)

## Non-Functional Requirements
- Low-latency filtering and aggregation for common matrix views.
- Modular backend and separately deployed frontend.
- Portable local development (SQLite) and production-ready deployment (PostgreSQL on Azure Container Apps).
- Clear UX for repetitive non-technical workflows; WiMi friction must be minimized.
- Scalable path for larger datasets and background exports.

## Assumptions
- `analysis_date` is unambiguously derivable from the `vk_number` format used by the organization.
- `user_id` auto-detection is based on session or network identity; the exact mechanism is resolved during implementation.
- The "predefined base dataset" is loaded by an administrator, not shipped with the application binary.
- Threshold configuration UI vs config file is deferred to the admin UX design phase; the spec only requires that thresholds be centrally stored and hot-reloadable.
- Report generation (nice-to-have) is out of scope for the first deliverable.
