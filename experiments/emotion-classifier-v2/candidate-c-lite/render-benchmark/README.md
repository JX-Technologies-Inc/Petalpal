# Candidate C-Lite isolated Render benchmark

This service loads only the already validated `model-int8.onnx`, tokenizer,
thresholds, and Garden Mood metadata. It has no database, Firebase, Prisma,
Cloudflare, frontend, Flower Engine, or production API dependency.

## Local smoke run

From `candidate-c-lite/` using an environment with the pinned dependencies:

```bash
BENCHMARK_REQUESTS_PER_CONCURRENCY=8 \
python render-benchmark/service.py --run-once --output /tmp/c-lite-smoke.json
```

## Render Docker settings

- The INT8 model is 125,895,662 bytes, which exceeds GitHub's normal 100 MiB
  per-file limit. Before Render can build from the repository, store only
  `model-int8.onnx` with Git LFS. Do not add the 476 MiB FP32 ONNX artifact to the
  benchmark deployment branch. Confirm Git LFS storage/bandwidth quota first.
- Alternatively, build this Dockerfile locally, push the resulting image to a
  container registry, and create the independent Render service from that image.
- Create a **new, independent Web Service**. Never select the existing PetalPal service.
- Runtime: Docker
- Repository root: repository root (do not set the experiment folder as Render root)
- Dockerfile path:
  `experiments/emotion-classifier-v2/candidate-c-lite/render-benchmark/Dockerfile`
- Health check path: `/health`
- No database and no secret environment variables are required.
- Start command is supplied by the Dockerfile.

## Recommended prebuilt image registry and tag

Use **GitHub Container Registry (GHCR)** rather than Docker Hub. The code already
lives in the `JX-Technologies-Inc` GitHub organization, so GHCR keeps source and the
benchmark image under one organization and avoids creating a separate Docker Hub
account. Publish a multi-architecture tag so Render can select its own Linux CPU
architecture:

```bash
docker login ghcr.io
docker buildx build --platform linux/amd64,linux/arm64 \
  -f experiments/emotion-classifier-v2/candidate-c-lite/render-benchmark/Dockerfile \
  -t ghcr.io/jx-technologies-inc/petalpal-c-lite-benchmark:2026-08-28 \
  -t ghcr.io/jx-technologies-inc/petalpal-c-lite-benchmark:latest \
  --push .
```

Use a GitHub token that has permission to write packages for the organization. Do not
run the commands above until a registry login and package visibility have been
confirmed. Render needs registry credentials if the GHCR package is private.

## Recommended first Render tier

Choose web-service compute plan **`1c-2g`** (legacy name: **Standard**) with exactly
one instance. It provides 1 CPU and 2 GB RAM. The cheaper Free/Starter choices provide
only 512 MB RAM, leaving too little headroom for a 120 MiB ONNX model, ONNX Runtime,
tokenizer, Python process, and concurrency 1/2/4 measurement. This is the lowest
available web-service plan with safe benchmark headroom; confirm its current price in
the Render Dashboard before creating the service.

The benchmark starts once automatically. Read `/results` until `status` is
`COMPLETE`, then save its JSON. `POST /benchmark` starts another run only after the
previous run completes. A process-level file lock prevents two complete benchmark
processes from running in the same container.

## Measurement scope

`applicationObservedStartupMs` covers process creation through the first completed
inference. Render scheduling, image pull, and container provisioning are not visible
inside the application and are not claimed as measured cold-start time.

An OS-level OOM kill cannot be persisted by a process after it is killed. Use Render
logs/events together with the JSON `oomObserved` and memory-limit utilization.

The local Python smoke test passed. A local Docker build was not completed because
the Docker/Colima daemon was not running; Render's build remains to be verified after
an artifact-delivery option is selected.
