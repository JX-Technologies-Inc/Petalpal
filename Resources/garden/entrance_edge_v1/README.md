# Entrance edge silhouette V1 — pending visual review

Only outer vegetation alpha on the Main Entrance PNG changed. All original RGB values remain identical. Protected paving, whole selected flower clusters, the complete landing, all opaque overlap pixels, runtime code, transforms, Land09 and other artwork are unchanged. Existing source was retained in source/road_original.png for reversal.

Used built-in image_gen to explore an edge contour (prompt retained). Its RGB artwork was rejected because it altered stones. Only its alpha contour was used outside protected paving/overlap/flower areas, with a pair of local interruptions adjusted to avoid broad notches. No new vegetation or decoration was added. build.py documents the masks.

Runtime inspected at close and normal Garden scale. Before/after and left/right closeups temporarily hide landmarks so the arch does not obscure the edges. The connection image and normal view show the arch restored. Alpha debug composites the actual final road and unchanged landing against solid mauve; it is not a generated candidate. Review crops are enlarged actual browser screenshots. Foreground visibility restored after QA.

The original 4,251 opaque paving overlap pixels and gap-free 20×145 world-pixel corridor remain unchanged. All seven requested outputs are in review/. Stopped for visual approval.
