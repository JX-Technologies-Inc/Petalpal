FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    BENCHMARK_ROOT=/benchmark \
    RUN_BENCHMARK_ON_STARTUP=true \
    BENCHMARK_REQUESTS_PER_CONCURRENCY=100 \
    ORT_INTRA_OP_THREADS=1 \
    ORT_INTER_OP_THREADS=1

WORKDIR /benchmark

COPY experiments/emotion-classifier-v2/candidate-c-lite/render-benchmark/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY experiments/emotion-classifier-v2/candidate-c-lite/artifacts/model-int8.onnx ./artifacts/model-int8.onnx
COPY experiments/emotion-classifier-v2/candidate-c-lite/artifacts/tokenizer/ ./artifacts/tokenizer/
COPY experiments/emotion-classifier-v2/candidate-c-lite/thresholds.json ./thresholds.json
COPY experiments/emotion-classifier-v2/candidate-c-lite/metrics.json ./metrics.json
COPY experiments/emotion-classifier-v2/candidate-c-lite/render-benchmark/service.py ./service.py

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').environ.get('PORT', '10000') + '/health', timeout=3)"

CMD ["python", "-u", "service.py"]
