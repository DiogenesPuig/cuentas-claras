# Microservicio de ingesta. Incluye el binario nativo de Tesseract (lo usa F2-2);
# por eso necesita un host con Docker (Fly.io), NO las Edge Functions de Supabase.
FROM python:3.12-slim

# Tesseract + idiomas es/en para el OCR de comprobantes (F2-2).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala el proyecto + extra `ocr`. Copiamos pyproject y el paquete `app`
# (setuptools necesita el código para resolver el build).
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir ".[ocr]"

# El hosting inyecta $PORT; default 8080.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
