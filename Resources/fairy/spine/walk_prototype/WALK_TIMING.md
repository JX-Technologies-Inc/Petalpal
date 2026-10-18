# Proposed four-pose walk sheet

This is an authoring plan, not a produced animation. Start at 24 timeline frames/second, one second per two-step loop. Four pose types repeat with opposite leg roles: eight keyed poses plus an identical closing key. Never mirror the approved image to exchange legs.

Pelvis Y offsets below use **source Y down**; negate them for Spine Y. Values are restrained initial suggestions, subject to visible geometry and manual review. Keep root fixed for the in-place clip, all scales 1, and no head bob beyond inherited body movement.

| Frame | Time | Pose | Contact / support | Pelvis source ΔY |
|---:|---:|---|---|---:|
| 0 | 0.000 s | Contact | Left heel forward; right toe trailing | 0 |
| 3 | 0.125 s | Down | Left sole accepts weight; right toe releases | +8 |
| 6 | 0.250 s | Passing | Left stance; right leg passes with modest knee bend | -4 |
| 9 | 0.375 s | Up | Left toe pushes; right foot reaches for contact | -8 |
| 12 | 0.500 s | Contact | Right heel forward; left toe trailing | 0 |
| 15 | 0.625 s | Down | Right sole accepts weight; left toe releases | +8 |
| 18 | 0.750 s | Passing | Right stance; left leg passes | -4 |
| 21 | 0.875 s | Up | Right toe pushes; left foot reaches | -8 |
| 24 | 1.000 s | Loop closure | Exact copy of frame 0 | 0 |

Use approximately 2–4 source pixels of lateral pelvis shift toward the supporting leg. Swing-foot clearance may start at 8–16 pixels if the existing mesh supports it. These are not mandatory deformations: avoid stretched shoes, inverted knees or exposed holes. At 108 px character height, the proposed 8-pixel body displacement is under one rendered pixel. Evaluate 96, 108 and 120 px character heights, uniformly scaling the whole preview by the master’s visible character height rather than treating the full padded canvas as character height.

Keep chest counter-rotation very small (roughly 0.5–1 degree). Arms may oppose the legs by 1–2 degrees only if shoulder/elbow seams remain intact. Wings can lag the torso with up to 1 degree of slow motion. Side/back petals may lag by two timeline frames with 1–2 degrees, while the waist remains attached. Hair, bun, flower and face can remain rigid in this first prototype. Secondary motion must not hide deficient foot contact.

## Prevent sliding

An in-place cycle has a fixed root, but stance feet move backward relative to the pelvis. They do not stay fixed in local space throughout stance. For a separate, non-looped travel test, move root forward linearly and counter that travel with each planted contact point so its world position stays fixed. Start with at most 120 source pixels of travel per full cycle (60 per step), then reduce to what the available leg geometry supports. This is a trial distance, not an approved runtime speed.

At 120 pixels/second root travel, a planted contact must move backward relative to root at the same speed. Permit heel-to-toe rolling around the active contact, not the entire shoe drifting. Inspect all interpolated frames, especially toe-off and heel strike. If contact cannot be held without distorting the painted leg, stop and record that limitation.

First inspect stepped keys, then use restrained interpolation and check every intermediate frame. Do not duplicate frame 24 in a looping export. Suggested review export: 12 FPS, 12 unique frames over one second. No walk has been authored or exported by this preparation task.
