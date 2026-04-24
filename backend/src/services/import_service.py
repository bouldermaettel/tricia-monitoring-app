from datetime import date, datetime
from io import BytesIO

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.case import Case, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.import_job import ImportJob


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
        normalized = frame.copy()
        normalized.columns = [str(column).strip() for column in normalized.columns]
        return normalized

    def _read_frame(self, file_name: str, content: bytes) -> tuple[pd.DataFrame, str]:
        fmt = "xlsx" if file_name.lower().endswith(".xlsx") else "csv"
        frame = pd.read_excel(BytesIO(content)) if fmt == "xlsx" else pd.read_csv(BytesIO(content))
        return self._normalize_columns(frame), fmt

    @staticmethod
    def _first_value(row: pd.Series, keys: list[str], default=None):
        lookup = {str(k).lower(): row[k] for k in row.index}
        for key in keys:
            if key.lower() in lookup and pd.notna(lookup[key.lower()]):
                return lookup[key.lower()]
        return default

    @staticmethod
    def _parse_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ("true", "yes", "1")
        return bool(value)

    @classmethod
    def _row_to_case_record(cls, row: pd.Series) -> dict[str, object]:
        analysis_date_raw = cls._first_value(row, ["analysis_date", "date_reported", "Date Reported"], date.today().isoformat())
        parsed_analysis_date = pd.to_datetime(analysis_date_raw, errors="coerce")
        analysis_date_text = (
            parsed_analysis_date.date().isoformat()
            if parsed_analysis_date is not pd.NaT and parsed_analysis_date is not None
            else date.today().isoformat()
        )

        input_timestamp_raw = cls._first_value(row, ["input_timestamp"], None)
        parsed_input_timestamp = pd.to_datetime(input_timestamp_raw, errors="coerce") if input_timestamp_raw is not None else None
        input_timestamp_text = (
            parsed_input_timestamp.to_pydatetime().isoformat() if parsed_input_timestamp is not pd.NaT and parsed_input_timestamp is not None else None
        )

        tricia_s = int(cls._first_value(row, ["TRI-S", "tricia_s"], 1))
        tricia_p = int(cls._first_value(row, ["TRI-P", "tricia_p"], 1))
        tricia_d = int(cls._first_value(row, ["TRI-D", "tricia_d"], 1))
        user_s = int(cls._first_value(row, ["WIMI-S", "user_s"], tricia_s))
        user_d = int(cls._first_value(row, ["WIMI-D", "user_d"], tricia_d))

        return {
            "vk_number": str(cls._first_value(row, ["vk_number", "VK"], "")).strip(),
            "device_name": str(cls._first_value(row, ["device_name", "Device"], "")).strip(),
            "analysis_date": analysis_date_text,
            "input_timestamp": input_timestamp_text,
            "wimi_shortcut": cls._first_value(row, ["wimi_shortcut", "user_id", "WIMI"], None),
            "validation_status": str(cls._first_value(row, ["validation_status", "Status"], "saved")),
            "tricia_s": tricia_s,
            "tricia_p": tricia_p,
            "tricia_d": tricia_d,
            "user_s": user_s,
            "user_d": user_d,
            "category_code": cls._first_value(row, ["category_code", "Category"], None),
            "risk_level": cls._first_value(row, ["risk_level"], None),
            "is_excluded": cls._parse_bool(cls._first_value(row, ["is_excluded", "Excl."], False)),
            "is_reviewed": cls._parse_bool(cls._first_value(row, ["is_reviewed", "Reviewed"], False)),
        }

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

    def preview_file(self, file_name: str, content: bytes) -> dict[str, object]:
        frame, _ = self._read_frame(file_name, content)
        case_items: list[dict[str, object]] = []
        control_items: list[dict[str, object]] = []
        for _, row in frame.iterrows():
            parsed = self._row_to_case_record(row)
            if not parsed["vk_number"]:
                continue
            case_items.append(parsed)
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
        total_rows = len(frame.index)
        imported_rows = 0
        error_rows = 0

        for _, row in frame.iterrows():
            try:
                parsed = self._row_to_case_record(row)
                if not parsed["vk_number"]:
                    error_rows += 1
                    continue

                existing_case = self.db.scalar(select(Case).where(Case.vk_number == parsed["vk_number"]))
                if existing_case is None:
                    case = Case(
                        vk_number=parsed["vk_number"],
                        device_name=parsed["device_name"],
                        analysis_date=date.fromisoformat(str(parsed["analysis_date"])),
                        source_type="import",
                        created_by_user_id=actor_id,
                        wimi_shortcut=parsed["wimi_shortcut"],
                        validation_status=parsed["validation_status"],
                    )
                    self.db.add(case)
                    self.db.flush()
                else:
                    case = existing_case
                    case.device_name = str(parsed["device_name"])
                    case.analysis_date = date.fromisoformat(str(parsed["analysis_date"]))
                    case.validation_status = str(parsed["validation_status"])
                    case.wimi_shortcut = parsed["wimi_shortcut"]

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
                        problem_flag=abs(int(parsed["user_d"]) - int(parsed["tricia_d"])) > 2,
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
                    snapshot.problem_flag = snapshot.deviation_d > 2

                review = self.db.scalar(select(CaseReview).where(CaseReview.case_id == case.id))
                if review is None:
                    review = CaseReview(case_id=case.id)
                    self.db.add(review)
                review.category_code = parsed["category_code"]
                review.is_excluded = bool(parsed["is_excluded"])
                review.is_reviewed = bool(parsed["is_reviewed"])
                review.risk_level = str(parsed["risk_level"] or "none")
                review.updated_by_user_id = actor_id
                review.updated_at = datetime.utcnow()

                imported_rows += 1
            except Exception:
                error_rows += 1

        job = ImportJob(
            file_name=file_name,
            file_format=fmt,
            status="completed",
            total_rows=total_rows,
            imported_rows=imported_rows,
            error_rows=error_rows,
            created_by_user_id=actor_id,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job
