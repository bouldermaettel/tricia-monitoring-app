from datetime import date
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.cases import CaseValidationRequest, CaseValidationResponse
from src.models.case import Case


class ValidationService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def derive_analysis_date(vk_number: str) -> date:
        """Extract YYYYMMDD from the VK identifier with validation."""
        match = re.search(r"(20\d{2})(\d{2})(\d{2})", vk_number)
        if match:
            year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            try:
                if 1 <= month <= 12 and 1 <= day <= 31:
                    return date(year, month, day)
            except ValueError:
                pass
        return date.today()

    @staticmethod
    def infer_user_id() -> str:
        """Infer user ID from environment or context. Fallback to 'anonymous'."""
        import os
        return os.environ.get("MONITORING_USER_ID", "anonymous")

    def validate(self, payload: CaseValidationRequest) -> CaseValidationResponse:
        duplicate = self.db.scalar(select(Case).where(Case.vk_number == payload.vk_number)) is not None
        user_d = payload.user_d if payload.user_d is not None else payload.tricia_d
        return CaseValidationResponse(
            analysis_date=self.derive_analysis_date(payload.vk_number),
            inferred_user_id=self.infer_user_id(),
            auto_fill={"user_s": payload.user_s, "user_d": user_d},
            duplicate=duplicate,
        )
