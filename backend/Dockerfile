FROM python:3.11-slim
WORKDIR /app
# Full tree required: setuptools uses package_dir "src" (see pyproject.toml).
COPY backend /app/backend
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -e /app/backend
ENV PYTHONPATH=/app/backend
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
