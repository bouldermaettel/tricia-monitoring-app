from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class ClassificationSnapshot(Base):
    __tablename__ = "classification_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    tricia_s: Mapped[int] = mapped_column(Integer)
    tricia_p: Mapped[int] = mapped_column(Integer)
    tricia_d: Mapped[int] = mapped_column(Integer)
    user_s: Mapped[int] = mapped_column(Integer)
    user_d: Mapped[int] = mapped_column(Integer)
    deviation_s: Mapped[int] = mapped_column(Integer)
    deviation_d: Mapped[int] = mapped_column(Integer)
    problem_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
