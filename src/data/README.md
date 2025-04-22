# Database Seed Data

Folder ini berisi data awal yang digunakan untuk mengisi database ketika aplikasi pertama kali dijalankan.

## Files

- `items.json` - Data item dasar (weapon, armor, resource, consumable)
- `monsters.json` - Data monster untuk PvE
- `zones.json` - Data zona dalam game

## Cara Menggunakan

Data seed akan otomatis dijalankan ketika aplikasi dijalankan dengan environment variable `SEED_DATABASE=true` dan jika data belum ada dalam database.

```
SEED_DATABASE=true npm start
```

## Struktur Data

### Items

Struktur data item mengikuti model `Item` dengan struktur berikut:

```json
{
  "itemId": "wooden_sword",
  "name": "Wooden Sword",
  "description": "A basic training sword made of wood",
  "type": "weapon",
  "subType": "sword",
  "tier": 1,
  "stats": {
    "damage": 5,
    "attackSpeed": 1.2
  },
  "requiredLevel": 1,
  "value": 10,
  "craftingRequirements": [
    {
      "itemId": "rough_logs",
      "quantity": 5
    }
  ],
  "dropRate": 0.5
}
```

### Monsters

Struktur data monster mengikuti model berikut:

```json
{
  "monsterId": "forest_wolf",
  "name": "Forest Wolf",
  "description": "A common wolf found in forests",
  "tier": 1,
  "health": 50,
  "attack": 5,
  "defense": 2,
  "experienceReward": 10,
  "drops": [
    {
      "itemId": "rough_hide",
      "chance": 0.8,
      "minQuantity": 1,
      "maxQuantity": 3
    }
  ],
  "gmoneyReward": {
    "min": 5,
    "max": 10
  },
  "spawnZones": ["safe"]
}
```

### Zones

Struktur data zona mengikuti model berikut:

```json
{
  "zoneId": "beginner_forest",
  "name": "Beginner Forest",
  "description": "A safe forest area for beginners",
  "type": "safe",
  "resources": [
    {
      "type": "wood",
      "abundance": 0.8
    },
    {
      "type": "stone",
      "abundance": 0.4
    }
  ],
  "monsters": [
    "forest_wolf",
    "forest_bandit"
  ],
  "neighboringZones": [
    "meadow_hills",
    "riverdale"
  ]
}
``` 