# B01 bridge-foot final local correction — visual review

Only `mobile/assets/garden/infrastructure/entrance-connections/b01-foot-landing.png` changed. All other baseline assets, code and transforms are unchanged, including approved Land09 V1 and Main Entrance V2.

Replaced round cobbles with staggered warm rectangular slabs matching the Main Entrance. The local paving candidate extends beneath the original bridge; original bridge alpha supplies foreground occlusion so deck, posts and bridge flowers remain visible above it. The unchanged arch also renders above the approach. The overlay has irregular local bounds, with no blur or broad alpha feather used to hide joints.

Built-in image_gen produced the local edit candidate. Exact prompt: `source/prompt.txt`. Only masked local pixels are installed; generated bridge/arch/water pixels are discarded. `source/paving-underlap.png` retains the underlap construction; `source/b01-foot-landing.png` is the runtime overlay. `build.py` reproduces it.

All four review images are actual `/garden-test` screenshots or enlarged crops. Before/after use the same camera and crop. Extreme closeup is an enlargement, not added detail. Normal-scale output retains the full 1280×720 Garden framing. Visually inspected both scales. No other review outputs are generated.

Restore `backup/b01-foot-landing.png` to the runtime path to undo this pass. Verification and baseline hashes are retained locally. Stopped for visual approval.
