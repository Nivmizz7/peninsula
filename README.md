# Peninsula

Escape from Tarkov raid planner powered by local JSON data.

## Start

```bash
npm start
```

Then open `http://localhost:3000`.

Admin page: `http://localhost:3000/admin`.

## Maps

Add map images to `public/maps/` using the `normalizedName` in `data/maps.json`.
Example: `public/maps/customs.png`.

## Notes

- Quests are stored in `data/quests/<map>.json` per map.
- Each quest has a `points` array with percent coordinates, optional `floorId`, and point `text`.
- Quest descriptions show in the right-side panel.

# MAPS ARE FROM SHEBUKA (https://github.com/the-hideout/tarkov-dev-svg-maps)
