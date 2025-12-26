# Map Calibration Guide

This project renders quest objective points from the Tarkov.dev API. The API gives world coordinates, which never line up perfectly with your SVG maps. Use the calibration system to align points to each map.

## Where to edit

Open `public/app.js` and find:

```js
const MAP_CALIBRATION = {
  // example:
  // "ground-zero": { flipX: false, flipY: true, swap: false, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
};
```

Add one entry per map (use the `normalizedName` from the API).

## What each field does

- `flipX`: mirror left/right.
- `flipY`: mirror up/down.
- `swap`: swap X and Y (rotate 90° if combined with flip).
- `offsetX`: move points horizontally (percentage of map width). Example: `0.02` moves 2% to the right.
- `offsetY`: move points vertically (percentage of map height). Example: `-0.03` moves 3% up.
- `scaleX`: stretch/shrink horizontally. Example: `1.05` makes it 5% wider.
- `scaleY`: stretch/shrink vertically. Example: `0.95` makes it 5% shorter.

All values are relative to the map image size.

## Suggested workflow

1. Pick a map and find **one objective** that should be in a known area.
2. Start with:

```js
"your-map": { flipX: false, flipY: true, swap: false, offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
```

3. If the point is mirrored left/right, toggle `flipX`.
4. If it is mirrored up/down, toggle `flipY`.
5. If it looks rotated 90°, toggle `swap` (and then try `flipX` / `flipY`).
6. When it is in the right area but not exact, adjust `offsetX` and `offsetY`.
7. If points align in one direction but drift in the other, adjust `scaleX` or `scaleY`.

## Example

```js
const MAP_CALIBRATION = {
  "ground-zero": { flipX: false, flipY: true, swap: false, offsetX: 0.01, offsetY: -0.02, scaleX: 1.02, scaleY: 0.98 },
  woods: { flipX: true, flipY: true, swap: false, offsetX: -0.01, offsetY: 0.03, scaleX: 1, scaleY: 1 },
};
```

## Notes

- Keep changes small (0.01 = 1% of map size).
- Use one quest with a clear landmark for tuning.
- If a map looks good after calibration, stop there and move to the next map.
