from datetime import date, datetime
from dataclasses import dataclass
from io import BytesIO

import pandas as pd
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.services.validation_service import ValidationService
from src.models.case import Case, CaseAuditEvent, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.import_job import ImportJob
from src.models.user import User
from src.services.threshold_service import ThresholdService


CANONICAL_IMPORT_COLUMNS: tuple[str, ...] = (
    "vk_number",
    "device_name",
    "TRI-S",
    "TRI-P",
    "TRI-D",
    "WIMI-S",
    "WIMI-P",
    "WIMI-D",
)
LEGACY_IMPORT_COLUMNS: tuple[str, ...] = tuple(column for column in CANONICAL_IMPORT_COLUMNS if column != "WIMI-P")
DERIVED_IMPORT_COLUMNS = ("TRI-RISK", "WIMI-RISK")
IMPORT_METADATA_COLUMNS = ("analysis_date", "validation_status")
IGNORED_IMPORT_COLUMNS = ("id",)
VALIDATION_STATUS_VALUES: tuple[str, ...] = ("draft", "validated", "saved")

SEVERITY_SCORE_VALUES: tuple[int, ...] = (1, 3, 5, 8, 10)
PROBABILITY_DETECTABILITY_VALUES: tuple[int, ...] = (1, 5, 10)


class DuplicateVkConflictError(ValueError):
    def __init__(self, duplicates: list[str]):
        self.duplicates = duplicates
        super().__init__("Duplicate VK-NR values found in import file.")


@dataclass
class ImportProcessResult:
    job: ImportJob
    replaced_rows: int = 0
    skipped_rows: int = 0

    def __getattr__(self, name: str):
        return getattr(self.job, name)


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_threshold_context(self) -> tuple[int, list[dict[str, int | str]]]:
        config = ThresholdService(self.db).get("default")
        return config.acceptance_threshold, config.risk_categories

    @staticmethod
    def _resolve_risk_class(score: int, categories: list[dict[str, int | str]]) -> int | None:
        for index, category in enumerate(sorted(categories, key=lambda item: int(item["min_value"]))):
            if int(category["min_value"]) <= score <= int(category["max_value"]):
                return index + 1
        return None

    @classmethod
    def _is_problematic_case(
        cls,
        tricia_s: int,
        tricia_p: int,
        tricia_d: int,
        user_s: int,
        user_p: int,
        user_d: int,
        acceptance_threshold: int,
        risk_categories: list[dict[str, int | str]],
    ) -> bool:
        expected_class = cls._resolve_risk_class(user_s * user_p * user_d, risk_categories)
        observed_class = cls._resolve_risk_class(tricia_s * tricia_d * tricia_p, risk_categories)
        if expected_class is None or observed_class is None:
            return False
        return abs(expected_class - observed_class) > acceptance_threshold

    @classmethod
    def _classify_case(
        cls,
        tricia_s: int,
        tricia_p: int,
        tricia_d: int,
        user_s: int,
        user_p: int,
        user_d: int,
        acceptance_threshold: int,
        risk_categories: list[dict[str, int | str]],
    ) -> dict[str, int | bool | None]:
        expected_class = cls._resolve_risk_class(user_s * user_p * user_d, risk_categories)
        observed_class = cls._resolve_risk_class(tricia_s * tricia_d * tricia_p, risk_categories)
        problem_flag = False
        if expected_class is not None and observed_class is not None:
            problem_flag = abs(expected_class - observed_class) > acceptance_threshold
        return {
            "expected_class": expected_class,
            "observed_class": observed_class,
            "problem_flag": problem_flag,
        }

    def _resolve_actor_user_id(self, actor_id: str) -> str | None:
        actor = self.db.scalar(select(User).where(or_(User.id == actor_id, User.external_key == actor_id)))
        return actor.id if actor is not None else None

    def _resolve_case_snapshot(self, case_id: str) -> ClassificationSnapshot:
        snapshot = self.db.scalar(select(ClassificationSnapshot).where(ClassificationSnapshot.case_id == case_id))
        if snapshot is None:
            snapshot = ClassificationSnapshot(
                case_id=case_id,
                tricia_s=1,
                tricia_p=1,
                tricia_d=1,
                user_s=1,
                user_p=1,
                user_d=1,
                deviation_s=0,
                deviation_d=0,
                problem_flag=False,
            )
            self.db.add(snapshot)
        return snapshot

    @staticmethod
    def _audit_change(changes: dict[str, dict[str, object]], key: str, before: object, after: object) -> None:
        if before != after:
            changes[key] = {"from": before, "to": after}

    def _resolve_actor_shortcut(self, actor_id: str) -> str | None:
        actor = self.db.scalar(select(User).where(or_(User.id == actor_id, User.external_key == actor_id)))
        if actor and actor.shortcut:
            return actor.shortcut
        return None

    @staticmethod
    def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
        normalized = frame.copy()
        normalized.columns = [str(column).strip() for column in normalized.columns]
        return normalized

    @staticmethod
    def _normalize_column_name(column: str) -> str:
        return str(column).strip().lower()

    @classmethod
    def _validate_columns(cls, frame: pd.DataFrame) -> None:
        actual_columns = [cls._normalize_column_name(column) for column in frame.columns]
        new_columns = [cls._normalize_column_name(column) for column in CANONICAL_IMPORT_COLUMNS]
        legacy_columns = [cls._normalize_column_name(column) for column in LEGACY_IMPORT_COLUMNS]
        derived_columns = [cls._normalize_column_name(column) for column in DERIVED_IMPORT_COLUMNS]
        actual_set = set(actual_columns)
        is_legacy = set(legacy_columns).issubset(actual_set) and "wimi-p" not in actual_set
        required_columns = legacy_columns if is_legacy else new_columns
        missing_columns = [column for column in required_columns if column not in actual_set]
        accepted_columns = set(
            new_columns
            + derived_columns
            + [cls._normalize_column_name(column) for column in IMPORT_METADATA_COLUMNS]
            + [cls._normalize_column_name(column) for column in IGNORED_IMPORT_COLUMNS]
        )
        extra_columns = [column for column in actual_columns if column not in accepted_columns]

        if missing_columns or extra_columns:
            details: list[str] = []
            if missing_columns:
                details.append(f"missing columns: {', '.join(missing_columns)}")
            if extra_columns:
                details.append(f"unexpected columns: {', '.join(extra_columns)}")
            raise ValueError("Invalid import file format (" + "; ".join(details) + ")")

        if len(actual_columns) != len(set(actual_columns)):
            raise ValueError("Invalid import file format (duplicate or reordered columns detected)")

    def _read_frame(self, file_name: str, content: bytes) -> tuple[pd.DataFrame, str]:
        fmt = "xlsx" if file_name.lower().endswith(".xlsx") else "csv"
        frame = pd.read_excel(BytesIO(content)) if fmt == "xlsx" else pd.read_csv(BytesIO(content))
        normalized = self._normalize_columns(frame)
        self._validate_columns(normalized)
        return normalized, fmt

    @staticmethod
    def _first_value(row: pd.Series, keys: list[str], default=None):
        lookup = {str(k).lower(): row[k] for k in row.index}
        for key in keys:
            if key.lower() in lookup and pd.notna(lookup[key.lower()]):
                return lookup[key.lower()]
        return default

    @staticmethod
    def _format_allowed_values(values: tuple[int, ...]) -> str:
        return ", ".join(str(value) for value in values)

    @classmethod
    def _parse_required_score(
        cls,
        row: pd.Series,
        row_number: int,
        column_name: str,
        allowed_values: tuple[int, ...],
        errors: list[str],
    ) -> int | None:
        raw_value = cls._first_value(row, [column_name], None)
        if raw_value is None:
            errors.append(f"Row {row_number}: column '{column_name}' is required.")
            return None

        try:
            parsed_value = int(raw_value)
        except (TypeError, ValueError):
            errors.append(
                f"Row {row_number}: column '{column_name}' must be one of [{cls._format_allowed_values(allowed_values)}]."
            )
            return None

        if parsed_value not in allowed_values:
            errors.append(
                f"Row {row_number}: column '{column_name}' must be one of [{cls._format_allowed_values(allowed_values)}]."
            )
            return None

        return parsed_value

    @classmethod
    def _validate_row(cls, row: pd.Series, row_number: int) -> tuple[dict[str, int | str] | None, list[str]]:
        errors: list[str] = []
        vk_number = str(cls._first_value(row, ["vk_number"], "")).strip()
        if not vk_number:
            errors.append(f"Row {row_number}: column 'vk_number' is required.")
        elif not ValidationService.is_valid_vk_number(vk_number):
            errors.append(
                f"Row {row_number}: VK-NR '{vk_number}' is invalid. Use format Vk_yyyymmdd_nnn with a real date, for example Vk_20240523_001."
            )

        device_name = str(cls._first_value(row, ["device_name"], "")).strip()
        if not device_name:
            errors.append(f"Row {row_number}: column 'device_name' is required.")

        tricia_s = cls._parse_required_score(row, row_number, "TRI-S", SEVERITY_SCORE_VALUES, errors)
        tricia_p = cls._parse_required_score(row, row_number, "TRI-P", PROBABILITY_DETECTABILITY_VALUES, errors)
        tricia_d = cls._parse_required_score(row, row_number, "TRI-D", PROBABILITY_DETECTABILITY_VALUES, errors)
        user_s = cls._parse_required_score(row, row_number, "WIMI-S", SEVERITY_SCORE_VALUES, errors)
        raw_user_p = cls._first_value(row, ["WIMI-P"], None)
        user_p = (
            cls._parse_required_score(row, row_number, "WIMI-P", PROBABILITY_DETECTABILITY_VALUES, errors)
            if raw_user_p is not None
            else tricia_p
        )
        user_d = cls._parse_required_score(row, row_number, "WIMI-D", PROBABILITY_DETECTABILITY_VALUES, errors)

        derived_analysis_date = ValidationService.derive_analysis_date(vk_number) if vk_number else date.today()
        raw_analysis_date = cls._first_value(row, ["analysis_date"], None)
        analysis_date = derived_analysis_date
        if raw_analysis_date is not None:
            try:
                parsed_analysis_date = pd.to_datetime(raw_analysis_date, errors="raise").date()
                if parsed_analysis_date != derived_analysis_date:
                    errors.append(
                        f"Row {row_number}: column 'analysis_date' must equal {derived_analysis_date.isoformat()} for VK-NR '{vk_number}'."
                    )
                else:
                    analysis_date = parsed_analysis_date
            except (TypeError, ValueError, OverflowError):
                errors.append(f"Row {row_number}: column 'analysis_date' must be a valid date.")

        raw_validation_status = cls._first_value(row, ["validation_status"], None)
        validation_status = "saved" if raw_validation_status is None else str(raw_validation_status).strip().lower()
        if validation_status not in VALIDATION_STATUS_VALUES:
            errors.append(
                f"Row {row_number}: column 'validation_status' must be one of [{cls._format_allowed_values(VALIDATION_STATUS_VALUES)}]."
            )

        if errors:
            return None, errors

        supplied_tri_risk = cls._first_value(row, ["TRI-RISK"], None)
        supplied_wimi_risk = cls._first_value(row, ["WIMI-RISK"], None)
        expected_tri_risk = int(tricia_s) * int(tricia_p) * int(tricia_d)
        expected_wimi_risk = int(user_s) * int(user_p) * int(user_d)
        for label, supplied, expected in (
            ("TRI-RISK", supplied_tri_risk, expected_tri_risk),
            ("WIMI-RISK", supplied_wimi_risk, expected_wimi_risk),
        ):
            if supplied is None:
                continue
            try:
                if int(supplied) != expected:
                    errors.append(f"Row {row_number}: column '{label}' must equal {expected}.")
            except (TypeError, ValueError):
                errors.append(f"Row {row_number}: column '{label}' must equal {expected}.")

        if errors:
            return None, errors

        return {
            "vk_number": vk_number,
            "device_name": device_name,
            "tricia_s": int(tricia_s),
            "tricia_p": int(tricia_p),
            "tricia_d": int(tricia_d),
            "user_s": int(user_s),
            "user_p": int(user_p),
            "user_d": int(user_d),
            "analysis_date": analysis_date,
            "validation_status": validation_status,
        }, []

    @staticmethod
    def _parse_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return bool(value)

    @classmethod
    def _row_to_case_record(cls, validated_row: dict[str, int | str], actor_shortcut: str | None) -> dict[str, object]:
        vk_number = str(validated_row["vk_number"])
        device_name = str(validated_row["device_name"])
        tricia_s = int(validated_row["tricia_s"])
        tricia_p = int(validated_row["tricia_p"])
        tricia_d = int(validated_row["tricia_d"])
        user_s = int(validated_row["user_s"])
        user_p = int(validated_row["user_p"])
        user_d = int(validated_row["user_d"])

        analysis_date = str(validated_row["analysis_date"])
        input_timestamp = datetime.utcnow().isoformat()
        wimi_shortcut = actor_shortcut

        return {
            "vk_number": vk_number,
            "device_name": device_name,
            "analysis_date": analysis_date,
            "input_timestamp": input_timestamp,
            "wimi_shortcut": wimi_shortcut,
            "validation_status": str(validated_row["validation_status"]),
            "tricia_s": tricia_s,
            "tricia_p": tricia_p,
            "tricia_d": tricia_d,
            "user_s": user_s,
            "user_p": user_p,
            "user_d": user_d,
            "tri_risk": tricia_s * tricia_p * tricia_d,
            "wimi_risk": user_s * user_p * user_d,
            "category_code": None,
            "risk_level": None,
            "is_excluded": False,
            "is_reviewed": False,
        }

    def _build_case_records(self, frame: pd.DataFrame, actor_shortcut: str | None) -> list[dict[str, object]]:
        errors: list[str] = []
        records: list[dict[str, object]] = []

        for row_index, (_, row) in enumerate(frame.iterrows(), start=2):
            validated_row, row_errors = self._validate_row(row, row_index)
            if row_errors:
                errors.extend(row_errors)
                continue
            if validated_row is None:
                continue
            records.append(self._row_to_case_record(validated_row, actor_shortcut))

        if errors:
            raise ValueError("\n".join(errors))

        return records

    @staticmethod
    def _delay_bucket(input_timestamp_text: str | None) -> str:
        if not input_timestamp_text:
            return "on_time"
        timestamp = datetime.fromisoformat(input_timestamp_text)
        age_hours = (datetime.utcnow() - timestamp).total_seconds() / 3600
        if age_hours >= 72:
            return "delayed_72h"
        if age_hours >= 24:
            return "delayed_24h"
        return "on_time"

    def preview_file(self, file_name: str, content: bytes, actor_id: str = "system") -> dict[str, object]:
        frame, _ = self._read_frame(file_name, content)
        actor_shortcut = self._resolve_actor_shortcut(actor_id)
        acceptance_threshold, risk_categories = self._get_threshold_context()
        case_items = self._build_case_records(frame, actor_shortcut)
        preview_cases: list[dict[str, object]] = []
        control_items: list[dict[str, object]] = []
        for parsed in case_items:
            classification = self._classify_case(
                tricia_s=int(parsed["tricia_s"]),
                tricia_p=int(parsed["tricia_p"]),
                tricia_d=int(parsed["tricia_d"]),
                user_s=int(parsed["user_s"]),
                user_p=int(parsed["user_p"]),
                user_d=int(parsed["user_d"]),
                acceptance_threshold=acceptance_threshold,
                risk_categories=risk_categories,
            )
            preview_cases.append({**parsed, **classification})
            control_items.append(
                {
                    "vk_number": parsed["vk_number"],
                    "analysis_date": parsed["analysis_date"],
                    "input_timestamp": parsed["input_timestamp"],
                    "wimi_shortcut": parsed["wimi_shortcut"],
                    "user_id": parsed["wimi_shortcut"],
                    "validation_status": parsed["validation_status"],
                    "delay_bucket": self._delay_bucket(parsed["input_timestamp"]),
                }
            )

        return {
            "total_rows": len(preview_cases),
            "cases": preview_cases,
            "control_items": control_items,
        }

    def process_file(
        self,
        file_name: str,
        content: bytes,
        actor_id: str,
        duplicate_action: str = "error",
    ) -> ImportProcessResult:
        frame, fmt = self._read_frame(file_name, content)
        actor_shortcut = self._resolve_actor_shortcut(actor_id)
        parsed_rows = self._build_case_records(frame, actor_shortcut)
        ClassificationSnapshot.sync_pk_sequence(self.db)
        uploaded_vk_numbers = [str(parsed["vk_number"]) for parsed in parsed_rows]
        existing_vk_numbers = set(
            self.db.scalars(select(Case.vk_number).where(Case.vk_number.in_(uploaded_vk_numbers))).all()
        )
        if duplicate_action not in {"error", "replace", "skip"}:
            raise ValueError("Invalid duplicate action. Use one of: error, replace, skip.")

        existing_cases = {
            case.vk_number: case
            for case in self.db.scalars(select(Case).where(Case.vk_number.in_(uploaded_vk_numbers))).all()
        }
        existing_vk_numbers = set(existing_cases.keys())
        if existing_vk_numbers and duplicate_action == "error":
            raise DuplicateVkConflictError(sorted(existing_vk_numbers))

        acceptance_threshold, risk_categories = self._get_threshold_context()
        total_rows = len(frame.index)
        imported_rows = 0
        error_rows = 0
        replaced_rows = 0
        skipped_rows = 0
        actor_user_id = self._resolve_actor_user_id(actor_id)
        actor_audit_id = actor_shortcut or actor_id

        for parsed in parsed_rows:
            vk_number = str(parsed["vk_number"])
            existing_case = existing_cases.get(vk_number)

            if existing_case is not None and duplicate_action == "skip":
                skipped_rows += 1
                continue

            if existing_case is None:
                case = Case(
                    vk_number=parsed["vk_number"],
                    device_name=parsed["device_name"],
                    analysis_date=date.fromisoformat(str(parsed["analysis_date"])),
                    source_type="import",
                    created_by_user_id=actor_user_id,
                    wimi_shortcut=parsed["wimi_shortcut"],
                    validation_status=parsed["validation_status"],
                )
                self.db.add(case)
                self.db.flush()
            else:
                case = existing_case
                changed_fields: dict[str, dict[str, object]] = {}
                next_device_name = str(parsed["device_name"])
                next_analysis_date = date.fromisoformat(str(parsed["analysis_date"]))
                next_wimi_shortcut = parsed["wimi_shortcut"]
                next_validation_status = str(parsed["validation_status"])
                next_source_type = "import"
                next_timestamp = datetime.utcnow()

                self._audit_change(changed_fields, "device_name", case.device_name, next_device_name)
                self._audit_change(changed_fields, "analysis_date", str(case.analysis_date), str(next_analysis_date))
                self._audit_change(changed_fields, "wimi_shortcut", case.wimi_shortcut, next_wimi_shortcut)
                self._audit_change(changed_fields, "validation_status", case.validation_status, next_validation_status)
                self._audit_change(changed_fields, "source_type", case.source_type, next_source_type)

                case.device_name = next_device_name
                case.analysis_date = next_analysis_date
                case.wimi_shortcut = next_wimi_shortcut
                case.validation_status = next_validation_status
                case.source_type = next_source_type
                case.input_timestamp = next_timestamp

                if changed_fields:
                    self.db.add(
                        CaseAuditEvent(
                            case_id=case.id,
                            action="import_replaced",
                            actor_id=actor_audit_id,
                            changes=changed_fields,
                        )
                    )
                replaced_rows += 1

            snapshot = self._resolve_case_snapshot(case.id)

            snapshot_changes: dict[str, dict[str, object]] = {}
            next_tricia_s = int(parsed["tricia_s"])
            next_tricia_p = int(parsed["tricia_p"])
            next_tricia_d = int(parsed["tricia_d"])
            next_user_s = int(parsed["user_s"])
            next_user_p = int(parsed["user_p"])
            next_user_d = int(parsed["user_d"])
            next_deviation_s = abs(next_user_s - next_tricia_s)
            next_deviation_d = abs(next_user_d - next_tricia_d)
            classification = self._classify_case(
                tricia_s=next_tricia_s,
                tricia_p=next_tricia_p,
                tricia_d=next_tricia_d,
                user_s=next_user_s,
                user_p=next_user_p,
                user_d=next_user_d,
                acceptance_threshold=acceptance_threshold,
                risk_categories=risk_categories,
            )
            next_problem_flag = bool(classification["problem_flag"])

            self._audit_change(snapshot_changes, "tricia_s", snapshot.tricia_s, next_tricia_s)
            self._audit_change(snapshot_changes, "tricia_p", snapshot.tricia_p, next_tricia_p)
            self._audit_change(snapshot_changes, "tricia_d", snapshot.tricia_d, next_tricia_d)
            self._audit_change(snapshot_changes, "user_s", snapshot.user_s, next_user_s)
            self._audit_change(snapshot_changes, "user_p", snapshot.user_p, next_user_p)
            self._audit_change(snapshot_changes, "user_d", snapshot.user_d, next_user_d)

            snapshot.tricia_s = next_tricia_s
            snapshot.tricia_p = next_tricia_p
            snapshot.tricia_d = next_tricia_d
            snapshot.user_s = next_user_s
            snapshot.user_p = next_user_p
            snapshot.user_d = next_user_d
            snapshot.tri_risk = next_tricia_s * next_tricia_p * next_tricia_d
            snapshot.wimi_risk = next_user_s * next_user_p * next_user_d
            snapshot.deviation_s = next_deviation_s
            snapshot.deviation_d = next_deviation_d
            snapshot.problem_flag = next_problem_flag

            if existing_case is not None and snapshot_changes:
                self.db.add(
                    CaseAuditEvent(
                        case_id=case.id,
                        action="import_replaced",
                        actor_id=actor_audit_id,
                        changes=snapshot_changes,
                    )
                )

            if existing_case is None:
                review = self.db.scalar(select(CaseReview).where(CaseReview.case_id == case.id))
                if review is None:
                    review = CaseReview(case_id=case.id)
                    self.db.add(review)
                review.category_code = parsed["category_code"]
                review.is_excluded = bool(parsed["is_excluded"])
                review.is_reviewed = bool(parsed["is_reviewed"])
                review.risk_level = str(parsed["risk_level"] or "none")
                review.updated_by_user_id = actor_user_id
                review.updated_at = datetime.utcnow()

            imported_rows += 1

        job = ImportJob(
            file_name=file_name,
            file_format=fmt,
            status="completed",
            total_rows=total_rows,
            imported_rows=imported_rows,
            error_rows=error_rows,
            created_by_user_id=actor_user_id,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return ImportProcessResult(job=job, replaced_rows=replaced_rows, skipped_rows=skipped_rows)
