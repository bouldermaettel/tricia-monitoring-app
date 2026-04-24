from typing import Any

from pydantic import BaseModel


class TableExportRequest(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
