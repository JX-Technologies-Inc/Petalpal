# B01 physical connection correction — not approved / not checkpointed

Extended the current warm-stone landing into the actual Main Entrance paved surface. Kept the approved upper landing pixels; replaced the baked foreground fragments in its lower end with a short continuous warm-slab neck. Original bridge, road, Land09 transition, arch, all other artwork and transforms remain unchanged.

The connected landing replaces the two obsolete B01 entrance underlay/foreground patches in the render list; their original files remain intact. Draw order is Main Entrance → connected landing → original B01 bridge → original B01 Land08 foreground → landmarks/entrance arch. Other circulation render relationships remain unchanged.

Verified 4,251 opaque road-paving overlap pixels, including 2,249 in the lower neck. A 20×145 world-pixel opaque corridor crosses the landing-to-road connection with zero gap pixels. The diagnostic uses actual runtime PNG masks at their runtime world transforms, not an illustration. Magenta marks overlap with warm opaque road paving; blue includes the complete road footprint, and orange is the landing/extension.

The arch-off view is an actual /garden-test screenshot captured using the existing Landmarks visibility toggle. This temporarily hides all landmarks; only the entrance is cropped for review. Foreground visibility was restored afterward. The arch-on and arch-off crops have identical camera and bounds. Runtime inspected with no foreground concealing the connection.

Built-in image_gen was used to extend local paving, with exact prompt in source/prompt.txt. Only the extension was masked into the landing asset; generated pixels outside that region were discarded. No alpha blur was used to join surfaces. Build and verification scripts are retained. No approval or checkpoint was created.
