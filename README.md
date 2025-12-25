# Peninsula

Escape from Tarkov raid planner powered by the Tarkov.dev API.

## Start

```bash
npm start
```

Then open `http://localhost:3000`.

## Maps

Add map images to `public/maps/` using the `normalizedName` from the API.
Example: `public/maps/customs.png`.

## Notes

- Quests and objectives are loaded from the API (no local data).
- Positions are projected relative to the image (normalized X/Y).
- Floors are inferred from the Z height of objectives.
