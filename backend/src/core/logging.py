import logging


_DEFAULT_RECORD_FACTORY = logging.getLogRecordFactory()


def _record_factory(*args, **kwargs) -> logging.LogRecord:
    record = _DEFAULT_RECORD_FACTORY(*args, **kwargs)
    if not hasattr(record, "request_id"):
        record.request_id = "-"
    return record


def configure_logging() -> None:
    logging.setLogRecordFactory(_record_factory)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] [request_id=%(request_id)s] %(message)s",
    )
