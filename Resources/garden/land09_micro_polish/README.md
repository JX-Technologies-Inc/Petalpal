# Land09 paving micro polish — awaiting approval

Only five small interior stone groups were edited. A few cooler gray-green stones extend toward the warm side, muted warmer stones extend back toward Land09, and one intermediate group mixes medium and medium-large pieces. The generated correction was applied through hard interior masks, at restrained color strength, with no spatial blur or alpha feathering.

Both existing overlay alpha masks are byte-identical. Width, silhouette, curb opening, vegetation, shoreline rocks, Main Entrance artwork, all code and transforms are unchanged. Only RGB within the two Land09 interface PNGs changed. Original copies and the complete pre-edit hash baseline are retained in source/. The unchanged masks preserve existing physical overlaps, including the B01 connection.

Runtime assets: mobile/assets/garden/infrastructure/land09-interface-v2/land09-broad-interface.png and land09-interface-foreground.png. Their existing world alignment and draw order are unchanged.

01 uses the prior actual live runtime capture immediately before this pass; 02 and 03 are fresh live runtime captures with matching camera. 04 is a fresh normal full-Garden runtime screenshot. Water animation may differ between captures. Reviewed at close and normal scale. No checkpoint created.

Built-in imagegen was used; source/generated.png and source/prompt.txt retain its result and exact prompt. build.py confines that result to the local interior edits. verification.json records file and alpha invariants.
