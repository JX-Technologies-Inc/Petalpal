# PetalPal Road POC

This review uses the approved `../source/road_straight_master.png`, copied byte for byte from `Resources/decorations/road/road_straight_master.png` (SHA-256 `f21de5546f90639254bea5490ab9c7fd14760c02cc35093e6114335d71d1ca37`). The source is never edited.

The median visible width of the approved road, measured at alpha > 100 across source columns 100–1435, is **237 pixels**. This is only the POC comparison width; final Garden world-space road scale remains undecided. All examples use the source's native apparent scale. Their transparent canvases are 1400×900 pixels.

`build_road_poc.py` samples each path by arc length. It cuts 116-pixel-long strips from the master every 64 path pixels, rotates each strip rigidly to the local tangent, and overlaps/feathers neighbors. Individual stones are never warped or scaled. The thin vegetation edges come from the same strips. For a road longer than one master image, the sampler can repeat an interior span with a 70-pixel source crossfade; that repeat mode is implemented but **has not been visually approved** by these three examples.

The three shapes are geometry proofs, not Garden placements. The outputs are raster images suitable for later use with the existing React Native Skia image layer. No Garden code is changed here. Before production use, the chosen Garden paths and any repeat joins need separate visual review.

## V2 reconstructed curves

`build_road_curve_v2.py` extracts 92 transparent stone patches into `stone_library/` with a source-coordinate manifest. The stone RGB pixels come directly from the approved master. It lays those patches individually along five offset rows, using each row's physical arc length so inner and outer bends retain similar stone spacing. Small source stones can fill residual gaps. A separate thin edge layer follows the corridor and retains the master's moss, tiny leaves, and occasional tiny edge rocks. The mortar underlay is matched to grout colors sampled from the master.

The V2 outputs are `road_poc_gentle_curve_v2.png`, `road_poc_s_curve_v2.png`, and `road_poc_curve_method_compare.png`. V1 images remain as the comparison baseline. The comparison uses identical centerlines, canvases, zoom, and a matched S-bend crop. At alpha > 100, median normal widths are 239 px for the V2 gentle curve and 238 px for the V2 S-curve. These V2 curves are review assets, not approved production roads.

To rebuild V1: install Pillow and NumPy, then run `python build_road_poc.py`. To rebuild V2: also install OpenCV, then run `python build_road_curve_v2.py`. Both scripts verify the approved source hash before rendering.
