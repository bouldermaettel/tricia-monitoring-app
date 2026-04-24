from io import BytesIO, StringIO

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.case import Case
from src.models.classification_snapshot import ClassificationSnapshot


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
