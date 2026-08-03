# Mobile Compact Ads Design

## Goal
Reduce large blank space below filled AdSense creatives on mobile detail pages while preserving existing unfilled/time-out collapse behavior and desktop ad behavior.

## Current behavior
`frontend/components/ads/AdBanner.vue` reserves `min-height: 280px` for mobile `auto` ads. This protects CLS while AdSense loads, but when AdSense returns a shorter mobile creative (for example 320×150), the parent still keeps 280px and leaves visible empty space.

The component already collapses when AdSense reports `unfilled`, `unfill-optimized`, or never sets `data-ad-status` within the timeout. The missing case is “filled but shorter than the reserved mobile auto slot.”

## Chosen approach
Add a compact fixed mobile ad variant modeled after ayo.pe.kr’s fixed mobile slot pattern.

- New `variant?: 'default' | 'compact-mobile'` prop on `AdBanner`.
- `compact-mobile` uses a centered fixed-size mobile slot: `display:inline-block; width:100%; max-width:336px; height:150px`.
- `compact-mobile` forces `data-full-width-responsive="false"` and uses a non-auto format (`horizontal`) unless the caller explicitly overrides.
- The wrapper reserves only 150px for this variant, so the large 280px mobile auto blank space is avoided.
- Existing default behavior remains unchanged for all other placements.

## Initial rollout
Apply the compact variant to the mobile-priority real-estate building detail inline ads that currently show the visible gap. Desktop remains unchanged because the variant still renders within the same component and only changes the slot sizing contract.

## Testing
Add unit coverage in `frontend/tests/components/ads/AdBanner.test.ts` for:

1. compact variant emits a fixed 150px inline slot;
2. compact variant disables full-width responsive mode;
3. compact variant adds a specific wrapper class for 150px reservation;
4. default `AdBanner` behavior remains `auto` + `full-width-responsive=true` without fixed height.
