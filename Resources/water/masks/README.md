# Garden spatial masks

These grayscale masks use the mobile Garden's top-left-origin world canvas. The generator reads `mobile/src/components/garden/gardenMapLayout.ts` for the current world dimensions and seven land placements, then uses the alpha channels from `mobile/assets/garden/land/`.

Regenerate from the project root:

```powershell
python -m pip install -r Resources/water/masks/requirements.txt
python Resources/water/masks/generate_water_masks.py
```

Each output mask is an uncropped, 8-bit grayscale PNG at the exact world size. Land occupancy uses source alpha at a threshold of 128. Enclosed alpha pinholes are filled so they cannot become isolated water cells. Shore influence fades smoothly from the water-side boundary to zero at 90 pixels. Open-water depth stays at zero through 28 pixels and reaches full strength at 200 pixels from land. These distances are review parameters, not final shader settings.

`water_mask_validation_overlay.png` uses the same placed production land images over the Garden's water background. Cyan shows shallow influence; blue shows open-water depth. It is a diagnostic image only.

## Visual-use masks

The generator also creates `shore_shallow_visual_mask.png` and `open_water_depth_visual_mask.png`. It validates existing raw masks instead of overwriting them. The visual masks retain the same 2400×1800 coordinates and are zero on land.

- Shallow influence tapers to zero by 55 pixels from land. Its local maximum is modulated from roughly 2.5% to 72%, with no pure white. A seeded 6×5 control field, upscaled across the world and blurred by 110 pixels, varies shoreline strength over several hundred pixels rather than adding fine texture.
- Open-water depth stays zero through 28 pixels from land and increases toward full influence around 235 pixels. A separate seeded 7×6 broad field shifts the distance transition by at most 45 pixels in either direction and modulates the final strength between 70% and 94%.
- Both fields use deterministic seed `20260922`. Debug previews, a low-opacity Garden overlay, and a raw-versus-visual comparison are in `visual_review/`.

These are grayscale influence masks for future shader work. No color is encoded in the production masks.
