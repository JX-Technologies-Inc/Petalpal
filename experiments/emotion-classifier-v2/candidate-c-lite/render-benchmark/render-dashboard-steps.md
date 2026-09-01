# Manual Render Dashboard steps

Do not edit or redeploy the existing PetalPal production service.

1. Choose one artifact delivery path before creating a service:
   - **Git LFS path:** confirm GitHub LFS quota, install Git LFS, and track only
     `experiments/emotion-classifier-v2/candidate-c-lite/artifacts/model-int8.onnx`.
     Commit the benchmark service, INT8 model, tokenizer, `thresholds.json`, and
     `metrics.json` to a dedicated benchmark branch. Do not commit the FP32 model or
     Candidate C checkpoint for this deployment.
   - **Prebuilt image path:** use GitHub Container Registry (GHCR), build and push a
     `linux/amd64,linux/arm64` multi-architecture image, and use Render's Existing
     Image flow. Configure registry credentials if the GHCR package is private.
2. Confirm the chosen storage, registry, Render tier, and any resulting price before
   continuing.
3. In Render Dashboard select **New > Web Service** (Git LFS path), or
   **New > Web Service > Existing Image** (prebuilt image path).
4. For the Git LFS path, select the PetalPal repository and benchmark branch.
5. Set a unique name such as `petalpal-c-lite-benchmark`.
6. For the Git LFS path, choose **Docker** runtime.
7. For the Git LFS path, leave Root Directory blank so the Docker build context is
   the repository root.
8. For the Git LFS path, set Dockerfile path to
   `experiments/emotion-classifier-v2/candidate-c-lite/render-benchmark/Dockerfile`.
9. Choose compute plan **`1c-2g` / Standard** and set instance count to **one**. This
   may create billing; confirm the tier and price before clicking Create Web Service.
10. Set health check path to `/health`.
11. Do not attach a PostgreSQL database and do not copy production secrets.
12. Disable automatic deploys if this should remain a one-run benchmark service.
13. Create the independent service and wait for `/health` to return `ok: true`.
14. Open `/results`. Wait for `status: COMPLETE`; do not redeploy merely because logs
    are temporarily quiet.
15. Download/copy the complete `/results` JSON and provide it for the macOS-vs-Render
    report.
16. If the service exits, inspect Render events for OOM before retrying. Confirm no
    old benchmark instance is still running before starting another benchmark.
17. Suspend or delete only the independent benchmark service after collecting data.
