from io import BytesIO

import pandas as pd
from sqlalchemy.orm import Session

from src.models.import_job import ImportJob


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def process_file(self, file_name: str, content: bytes, actor_id: str) -> ImportJob:
        fmt = "xlsx" if file_name.lower().endswith(".xlsx") else "csv"
        frame = pd.read_excel(BytesIO(content)) if fmt == "xlsx" else pd.read_csv(BytesIO(content))
        total_rows = len(frame.index)

        job = ImportJob(
            file_name=file_name,
            file_format=fmt,
            status="completed",
            total_rows=total_rows,
            imported_rows=total_rows,
            error_rows=0,
            created_by_user_id=actor_id,
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job
