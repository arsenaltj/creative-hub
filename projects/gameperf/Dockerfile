FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 GP_DATA_DIR=/data
WORKDIR /app
COPY requirements.txt requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 studio \
    && useradd --uid 10001 --gid studio --create-home studio \
    && mkdir -p /data && chown studio:studio /data
COPY --chown=studio:studio app ./app
COPY --chown=studio:studio web ./web
COPY --chown=studio:studio scripts ./scripts
COPY --chown=studio:studio manage.py ./
USER 10001:10001
EXPOSE 8765
# Exec-form startup. The web API exposes no remote execution action; proxy headers are not trusted.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765", "--workers", "1", "--no-proxy-headers"]
