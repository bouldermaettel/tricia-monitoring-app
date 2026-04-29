from io import BytesIO, StringIO
import json

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.case import Case
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.case import CaseAuditEvent

_FIELD_LABELS: dict[str, str] = {
    "tricia_s": "TRI-S",
    "tricia_p": "TRI-P",
    "tricia_d": "TRI-D",
    "user_s": "WIMI-S",
    "user_d": "WIMI-D",
    "category_code": "Category",
    "is_excluded": "Excluded",
    "is_reviewed": "Reviewed",
    "risk_level": "Risk Level",
    "device_name": "Device Name",
    "analysis_date": "Analysis Date",
    "validation_status": "Validation Status",
    "comment_text": "Comment",
    "vk_number": "VK Number",
}


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _frame(self) -> pd.DataFrame:
        rows = self.db.execute(
            select(Case, ClassificationSnapshot)
            .join(ClassificationSnapshot, ClassificationSnapshot.case_id == Case.id, isouter=True)
        ).all()
        return pd.DataFrame(
            [
                {
                    "id": c.id,
                    "vk_number": c.vk_number,
                    "device_name": c.device_name,
                    "analysis_date": c.analysis_date.isoformat(),
                    "validation_status": c.validation_status,
                    "TRI-S": snap.tricia_s if snap else None,
                    "TRI-P": snap.tricia_p if snap else None,
                    "TRI-D": snap.tricia_d if snap else None,
                    "WIMI-S": snap.user_s if snap else None,
                    "WIMI-D": snap.user_d if snap else None,
                }
                for c, snap in rows
            ]
        )

    def to_csv(self) -> bytes:
        output = StringIO()
        self._frame().to_csv(output, index=False)
        return output.getvalue().encode("utf-8")

    def to_xlsx(self) -> bytes:
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            self._frame().to_excel(writer, sheet_name="cases", index=False)
        return output.getvalue()

    @staticmethod
    def _table_frame(columns: list[str], rows: list[dict]) -> pd.DataFrame:
        frame = pd.DataFrame(rows)
        if not columns:
            return frame
        # Keep requested export order and fill missing fields with empty values.
        return frame.reindex(columns=columns, fill_value="")

    @staticmethod
    def table_to_csv(columns: list[str], rows: list[dict]) -> bytes:
        output = StringIO()
        ExportService._table_frame(columns, rows).to_csv(output, index=False)
        return output.getvalue().encode("utf-8")

    @staticmethod
    def table_to_xlsx(columns: list[str], rows: list[dict]) -> bytes:
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            ExportService._table_frame(columns, rows).to_excel(writer, sheet_name="table", index=False)
        return output.getvalue()

    def audit_trail_to_xlsx(self, case_id: str) -> bytes:
        case = self.db.scalar(select(Case).where(Case.id == case_id))
        vk_number = case.vk_number if case else case_id

        events = self.db.execute(
            select(CaseAuditEvent)
            .where(CaseAuditEvent.case_id == case_id)
            .order_by(CaseAuditEvent.created_at.asc())
        ).scalars().all()

        rows = []
        for e in events:
            changes = e.changes or {}
            if not changes:
                rows.append({
                    "Timestamp": e.created_at.strftime("%Y-%m-%d %H:%M:%S") if e.created_at else "",
                    "Actor": e.actor_id or "",
                    "Action": e.action,
                    "Field": "",
                    "From": "",
                    "To": "",
                })
            else:
                for field, delta in changes.items():
                    label = _FIELD_LABELS.get(field, field)
                    from_val = delta.get("from") if isinstance(delta, dict) else ""
                    to_val = delta.get("to") if isinstance(delta, dict) else ""
                    rows.append({
                        "Timestamp": e.created_at.strftime("%Y-%m-%d %H:%M:%S") if e.created_at else "",
                        "Actor": e.actor_id or "",
                        "Action": e.action,
                        "Field": label,
                        "From": "" if from_val is None else str(from_val),
                        "To": "" if to_val is None else str(to_val),
                    })

        df = pd.DataFrame(rows, columns=["Timestamp", "Actor", "Action", "Field", "From", "To"])
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name=f"Audit {vk_number}", index=False)
        return output.getvalue()
