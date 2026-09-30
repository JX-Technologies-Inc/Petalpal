# Land06 flower occlusion

Land06 / June flower visuals render after the land and before every Afternoon Tea Set layer (chair bases, table, occluders, and overlays). The existing PNG alpha supplies natural occlusion; there is no rectangular clip, duplicate Tea Set draw, or artwork modification.

`LandmarkLayer.behindTeaSet` is a world-space render slot immediately before the existing Tea Set transform. The DEV density sandbox routes all June preview modes through this slot. Other months retain their previous foreground order.

The Garden uses the same slot for the Land06 pass of `PlantedFlowerLayer`, including planting/adjustment previews. Its foreground pass excludes those flowers. When landmarks are hidden, one full flower pass remains visible. Future production flower artwork must preserve this ownership-based partition through `flowerOcclusion.ts`; visual bounds and world Y must never move Land06 flowers above the Tea Set.

Only drawing order changes. Masks, placement data, anchors, collision, visual dimensions/scales, composition, Tea Set placement and artwork remain unchanged. This does not approve Tulip artwork for production.

Manual review: June / Land06 / 30 / V3, inspect flower overlaps with both chairs and the table; the Tea Set must cover overlapping petals/stems. October / Land10 / 30 keeps its previous draw order. No browser or screenshot automation is required.
