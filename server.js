import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Helper: Get all games of a user
async function getGames(userId) {
  let games = [];
  let cursor = "";
  do {
    const url = `https://games.roblox.com/v2/users/${userId}/games?sortOrder=Asc&limit=100&cursor=${cursor}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    games.push(...data.data.map(g => g.id));
    cursor = data.nextPageCursor || "";
  } while (cursor);
  return games;
}

// Helper: Get GamePasses for a universe
async function getGamePasses(universeId) {
  let passes = [];
  let pageToken = "";
  do {
    const url = `https://apis.roblox.com/game-passes/v1/game-passes/${universeId}/details?limit=100&pageToken=${pageToken}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) {
      for (const pass of data.data) {
        if (pass.price && pass.price > 0) {
          passes.push({
            Name: pass.name || "Unnamed Pass",
            Price: pass.price,
            Id: pass.id,
            ItemType: "GamePass"
          });
        }
      }
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return passes;
}

// Helper: Get creatorId from userId
async function getCreatorId(userId) {
  const url = "https://users.roblox.com/v1/users";
  const body = JSON.stringify({ userIds: [userId] });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data && data.data[0] ? data.data[0].id : null;
}

// Helper: Get catalog assets for a creator
async function getCatalogAssets(creatorId) {
  let assets = [];
  let cursor = "";
  do {
    const url = `https://apis.roblox.com/marketplace-items/v1/items?creatorTargetId=${creatorId}&creatorType=User&limit=30&cursor=${cursor}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (data.data) {
      for (const asset of data.data) {
        if (asset.price && asset.price > 0) {
          assets.push({
            Name: asset.name || "Unnamed Item",
            Description: asset.description || "",
            Price: asset.price,
            Id: asset.id,
            ItemType: asset.itemType || "Asset"
          });
        }
      }
    }
    cursor = data.nextPageCursor || "";
  } while (cursor);
  return assets;
}

// Endpoint: Fetch all GamePasses and Catalog Assets for a user
app.get("/fetchAll/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const universeIds = await getGames(userId);
    let allPasses = [];
    for (const id of universeIds) {
      const passes = await getGamePasses(id);
      allPasses.push(...passes);
    }
    allPasses.sort((a, b) => a.Price - b.Price);

    const creatorId = await getCreatorId(userId);
    let catalog = [];
    if (creatorId) catalog = await getCatalogAssets(creatorId);
    catalog.sort((a, b) => a.Price - b.Price);

    res.json({
      GamePasses: allPasses,
      CatalogAssets: catalog
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
