from datetime import date, datetime
from io import BytesIO

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.services.validation_service import ValidationService
from src.models.case import Case, CaseReview
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
    "WIMI-D",
)

SEVERITY_SCORE_VALUES: tuple[int, ...] = (1, 3, 5, 8, 10)
PROBABILITY_DETECTABILITY_VALUES: tuple[int, ...] = (1, 5, 10)


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
        user_d: int,
        acceptance_threshold: int,
        risk_categories: list[dict[str, int | str]],
    ) -> bool:
        expected_class = cls._resolve_risk_class(user_s * user_d * tricia_p, risk_categories)
        observed_class = cls._resolve_risk_class(tricia_s * tricia_d * tricia_p, risk_categories)
        if expected_class is None or observed_class is None:
            return False
        return abs(expected_class - observed_class) > acceptance_threshold

    def _resolve_actor_user_id(self, actor_id: str) -> str | None:
        actor = self.db.scalar(select(User.id).where(User.id == actor_id))
        return actor if actor is not None else None

    def _resolve_actor_shortcut(self, actor_id: str) -> str:
        actor = self.db.scalar(select(User).where(User.id == actor_id))
        if actor and actor.shortcut:
            return actor.shortcut
        return actor_id

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
        expected_columns = [cls._normalize_column_name(column) for column in CANONICAL_IMPORT_COLUMNS]

        missing_columns = [column for column in expected_columns if column not in actual_columns]
        extra_columns = [column for column in actual_columns if column not in expected_columns]

        if missing_columns or extra_columns:
            details: list[str] = []
            if missing_columns:
                details.append(f"missing columns: {', '.join(missing_columns)}")
            if extra_columns:
                details.append(f"unexpected columns: {', '.join(extra_columns)}")
            raise ValueError("Invalid import file format (" + "; ".join(details) + ")")

        if len(actual_columns) != len(expected_columns):
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
        user_d = cls._parse_required_score(row, row_number, "WIMI-D", PROBABILITY_DETECTABILITY_VALUES, errors)

        if errors:
            return None, errors

        return {
            "vk_number": vk_number,
            "device_name": device_name,
            "tricia_s": int(tricia_s),
            "tricia_p": int(tricia_p),
            "tricia_d": int(tricia_d),
            "user_s": int(user_s),
            "user_d": int(user_d),
        }, []

    @staticmethod
    def _parse_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return bool(value)

    @classmethod
    def _row_to_case_record(cls, validated_row: dict[str, int | str], actor_shortcut: str) -> dict[str, object]:
        vk_number = str(validated_row["vk_number"])
        device_name = str(validated_row["device_name"])
        tricia_s = int(validated_row["tricia_s"])
        tricia_p = int(validated_row["tricia_p"])
        tricia_d = int(validated_row["tricia_d"])
        user_s = int(validated_row["user_s"])
        user_d = int(validated_row["user_d"])

        analysis_date = ValidationService.derive_analysis_date(vk_number)
        input_timestamp = datetime.utcnow().isoformat()
        wimi_shortcut = actor_shortcut

        return {
            "vk_number": vk_number,
            "device_name": device_name,
            "analysis_date": analysis_date.isoformat(),
            "input_timestamp": input_timestamp,
            "wimi_shortcut": wimi_shortcut,
            "validation_status": "saved",
            "tricia_s": tricia_s,
            "tricia_p": tricia_p,
            "tricia_d": tricia_d,
            "user_s": user_s,
            "user_d": user_d,
            "category_code": None,
            "risk_level": None,
            "is_excluded": False,
            "is_reviewed": False,
        }

    def _build_case_records(self, frame: pd.DataFrame, actor_shortcut: str) -> list[dict[str, object]]:
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
        case_items = self._build_case_records(frame, actor_shortcut)
        control_items: list[dict[str, object]] = []
        for parsed in case_items:
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
            "total_rows": len(case_items),
            "cases": case_items,
            "control_items": control_items,
        }

    def process_file(self, file_name: str, content: bytes, actor_id: str) -> ImportJob:
        frame, fmt = self._read_frame(file_name, content)
        actor_shortcut = self._resolve_actor_shortcut(actor_id)
        parsed_rows = self._build_case_records(frame, actor_shortcut)
        uploaded_vk_numbers = [str(parsed["vk_number"]) for parsed in parsed_rows]
        existing_vk_numbers = set(
            self.db.scalars(select(Case.vk_number).where(Case.vk_number.in_(uploaded_vk_numbers))).all()
        )
        if existing_vk_numbers:
            duplicate_errors = [
                f"VK-NR '{vk_number}' is already in the database."
                for vk_number in sorted(existing_vk_numbers)
            ]
            raise ValueError("\n".join(duplicate_errors))

        acceptance_threshold, risk_categories = self._get_threshold_context()
        total_rows = len(frame.index)
        imported_rows = 0
        error_rows = 0

        for parsed in parsed_rows:
            case = Case(
                vk_number=parsed["vk_number"],
                device_name=parsed["device_name"],
                analysis_date=date.fromisoformat(str(parsed["analysis_date"])),
                source_type="import",
                created_by_user_id=self._resolve_actor_user_id(actor_id),
                wimi_shortcut=parsed["wimi_shortcut"],
                validation_status=parsed["validation_status"],
            )
            self.db.add(case)
            self.db.flush()

            snapshot = self.db.scalar(select(ClassificationSnapshot).where(ClassificationSnapshot.case_id == case.id))
            if snapshot is None:
                snapshot = ClassificationSnapshot(
                    case_id=case.id,
                    tricia_s=int(parsed["tricia_s"]),
                    tricia_p=int(parsed["tricia_p"]),
                    tricia_d=int(parsed["tricia_d"]),
                    user_s=int(parsed["user_s"]),
                    user_d=int(parsed["user_d"]),
                    deviation_s=abs(int(parsed["user_s"]) - int(parsed["tricia_s"])),
                    deviation_d=abs(int(parsed["user_d"]) - int(parsed["tricia_d"])),
                    problem_flag=self._is_problematic_case(
                        tricia_s=int(parsed["tricia_s"]),
                        tricia_p=int(parsed["tricia_p"]),
                        tricia_d=int(parsed["tricia_d"]),
                        user_s=int(parsed["user_s"]),
                        user_d=int(parsed["user_d"]),
                        acceptance_threshold=acceptance_threshold,
                        risk_categories=risk_categories,
                    ),
                )
                self.db.add(snapshot)
            else:
                snapshot.tricia_s = int(parsed["tricia_s"])
                snapshot.tricia_p = int(parsed["tricia_p"])
                snapshot.tricia_d = int(parsed["tricia_d"])
                snapshot.user_s = int(parsed["user_s"])
                snapshot.user_d = int(parsed["user_d"])
                snapshot.deviation_s = abs(snapshot.user_s - snapshot.tricia_s)
                snapshot.deviation_d = abs(snapshot.user_d - snapshot.tricia_d)
                snapshot.problem_flag = self._is_problematic_case(
                    tricia_s=snapshot.tricia_s,
                    tricia_p=snapshot.tricia_p,
                    tricia_d=snapshot.tricia_d,
                    user_s=snapshot.user_s,
                    user_d=snapshot.user_d,
                    acceptance_threshold=acceptance_threshold,
                    risk_categories=risk_categories,
                )

            review = self.db.scalar(select(CaseReview).where(CaseReview.case_id == case.id))
            if review is None:
                review = CaseReview(case_id=case.id)
                self.db.add(review)
            review.category_code = parsed["category_code"]
            review.is_excluded = bool(parsed["is_excluded"])
            review.is_reviewed = bool(parsed["is_reviewed"])
            review.risk_level = str(parsed["risk_level"] or "none")
            review.updated_by_user_id = self._resolve_actor_user_id(actor_id)
            review.updated_at = datetime.utcnow()

            imported_rows += 1

        job = ImportJob(
            file_name=file_name,
            file_format=fmt,
            status="completed",
            total_rows=total_rows,
            imported_rows=imported_rows,
            error_rows=error_rows,
            created_by_user_id=self._resolve_actor_user_id(actor_id),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job
