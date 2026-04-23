# Data Model: Monitoring Tool

## Overview
The model keeps case input, review workflow, confusion-matrix analytics, and centralized configuration normalized so operational data entry and analytical reads can evolve independently.

## Entities

### Case
Primary record for a classified item.

Fields:
- `id`: UUID or integer primary key.
- `vk_number`: string, unique business identifier.
- `device_name`: string, required.
- `analysis_date`: date, derived from `vk_number`, indexed.
- `input_timestamp`: timestamp with timezone, required.
- `source_type`: enum, values `manual`, `csv_import`, `excel_import`.
- `created_by_user_id`: foreign key to `user.id`, nullable for imported historical data.
- `validation_status`: enum, values `draft`, `validated`, `saved`.

Validation rules:
- `vk_number` must be unique.
- `analysis_date` must be derivable from `vk_number` or explicitly provided during import.
- `validation_status = saved` requires at least one associated validation snapshot.

Relationships:
- One case has one latest classification snapshot.
- One case has many comments.
- One case has many review events.
- One case may belong to zero or one category.

### ClassificationSnapshot
Stores the compared algorithm and human-entered values used for matrix generation.

Fields:
- `id`: primary key.
- `case_id`: foreign key to `case.id`.
- `tricia_s`: integer, required.
- `tricia_p`: integer, required.
- `tricia_d`: integer, required.
- `user_s`: integer, required.
- `user_d`: integer, required.
- `deviation_s`: integer, derived as `abs(user_s - tricia_s)`.
- `deviation_d`: integer, derived as `abs(user_d - tricia_d)`.
- `problem_flag`: boolean, derived when configured deviation threshold is exceeded.
- `created_at`: timestamp.

Validation rules:
- Score fields must be integers within the domain accepted by the classification workflow.
- Derived deviation fields are write-protected at the API boundary.

Relationships:
- Many snapshots belong to one case.

### CaseCategory
Reference table for operator-assigned case categorization.

Fields:
- `code`: primary key string.
- `label`: string.
- `description`: string.
- `is_active`: boolean.

Seed values:
- `no_issue`
- `monitor`
- `problem`

### CaseReview
Tracks mutable review state for case-level follow-up.

Fields:
- `id`: primary key.
- `case_id`: foreign key to `case.id`.
- `category_code`: foreign key to `case_category.code`, nullable.
- `is_excluded`: boolean, default `false`.
- `is_reviewed`: boolean, default `false`.
- `risk_level`: enum, values `false_low`, `false_high`, `mixed`, `none`.
- `updated_by_user_id`: foreign key to `user.id`.
- `updated_at`: timestamp.

Validation rules:
- Exclusion and review updates must be auditable through review events.

### CaseComment
Stores free-text annotations.

Fields:
- `id`: primary key.
- `case_id`: foreign key to `case.id`.
- `comment_text`: text, required.
- `created_by_user_id`: foreign key to `user.id`.
- `created_at`: timestamp.

### User
Lightweight actor record.

Fields:
- `id`: primary key.
- `external_key`: string, unique, used for auto-detection or manual fallback.
- `display_name`: string.
- `role`: enum, values `operator`, `analyst`, `controller`, `admin`.
- `is_active`: boolean.

### ThresholdConfig
Central store for matrix evaluation and workflow rules.

Fields:
- `id`: primary key.
- `config_key`: string, unique.
- `acceptance_threshold`: integer.
- `problem_threshold`: integer.
- `include_excluded_default`: boolean.
- `effective_from`: timestamp.
- `updated_by_user_id`: foreign key to `user.id`.
- `updated_at`: timestamp.

Validation rules:
- Only one active threshold record per `config_key` at a time.
- Threshold values must be non-negative integers.

### ImportJob
Tracks uploaded files and row-level outcomes.

Fields:
- `id`: primary key.
- `file_name`: string.
- `file_format`: enum, values `csv`, `xlsx`.
- `status`: enum, values `received`, `processing`, `completed`, `failed`.
- `total_rows`: integer.
- `imported_rows`: integer.
- `error_rows`: integer.
- `created_by_user_id`: foreign key to `user.id`.
- `created_at`: timestamp.
- `completed_at`: timestamp, nullable.

### ImportJobError
Stores import validation failures without blocking valid rows.

Fields:
- `id`: primary key.
- `import_job_id`: foreign key to `import_job.id`.
- `row_number`: integer.
- `field_name`: string.
- `error_code`: string.
- `message`: text.

## Relationships
- `case 1 -> many classification_snapshot`
- `case 1 -> many case_comment`
- `case 1 -> many case_review`
- `case_review many -> 1 case_category`
- `user 1 -> many case`
- `user 1 -> many case_review`
- `user 1 -> many case_comment`
- `user 1 -> many threshold_config`
- `import_job 1 -> many import_job_error`

## Derived Views

### ConfusionMatrixAggregate
Materialized at query time from `classification_snapshot` joined to the latest `case_review`.

Fields:
- `expected_value`
- `observed_value`
- `case_count`
- `excluded_case_count`
- `problem_case_count`
- `within_threshold_count`

Use:
- Supports matrix dashboard display and color coding.

### ControlQueueItem
Read model for the control dashboard.

Fields:
- `vk_number`
- `analysis_date`
- `input_timestamp`
- `created_by_user_id`
- `validation_status`
- `delay_bucket`

Use:
- Supports identification of missing or delayed work.

## State Transitions
- `Case.validation_status`: `draft -> validated -> saved`
- `ImportJob.status`: `received -> processing -> completed | failed`
- `CaseReview.is_reviewed`: `false -> true`, with reversible admin override if needed
