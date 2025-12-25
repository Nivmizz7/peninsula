# Peninsula

Raid planner Escape from Tarkov, base sur l'API Tarkov.dev.

## Demarrer

```bash
npm start
```

Puis ouvrir `http://localhost:3000`.

## Maps

Ajoute les images de map dans `public/maps/` avec le nom `normalizedName` fourni par l'API.
Exemple: `public/maps/customs.png`.

## Notes

- Les quetes et objectifs sont charges via l'API (aucune donnee locale).
- Les positions sont projetees de maniere relative sur l'image (X/Y normalises).
- Les etages sont detectes via la hauteur Z des objectifs.
