from pydantic import BaseModel


class ImportJobResponse(BaseModel):
    job_id: str
    status: str
    total_rows: int
    imported_rows: int
    error_rows: int
