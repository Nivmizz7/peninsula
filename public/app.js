const MAPS = [
  "The Labs",
  "Ground Zero",
  "Woods",
  "Customs",
  "Factory",
  "Interchange",
  "Lighthouse",
  "Shoreline",
  "Terminal"
];

const STORAGE_KEY = "eft-quest-panel";

const elements = {
  questForm: document.querySelector("#quest-form"),
  questName: document.querySelector("#quest-name"),
  questMap: document.querySelector("#quest-map"),
  questList: document.querySelector("#quest-list"),
  selectedQuest: document.querySelector("#selected-quest"),
  currentMap: document.querySelector("#current-map"),
  mapPill: document.querySelector("#map-pill"),
  mapMessage: document.querySelector("#map-message"),
  canvas: document.querySelector("#map-canvas")
};

const ctx = elements.canvas.getContext("2d");
const mapImage = new Image();
mapImage.src = "/maps/maps.png";

const state = {
  quests: [],
  selectedQuestId: null,
  currentMap: MAPS[0]
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.quests = Array.isArray(parsed.quests) ? parsed.quests : [];
    state.selectedQuestId = parsed.selectedQuestId || null;
    state.currentMap = parsed.currentMap || MAPS[0];
  } catch (err) {
    console.warn("Failed to parse stored state", err);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      quests: state.quests,
      selectedQuestId: state.selectedQuestId,
      currentMap: state.currentMap
    })
  );
}

function createOption(value) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  return option;
}

function populateSelects() {
  MAPS.forEach((map) => {
    elements.questMap.appendChild(createOption(map));
    elements.currentMap.appendChild(createOption(map));
  });
}

function formatPoint(point) {
  return `x:${Math.round(point.x)} y:${Math.round(point.y)}`;
}

function getQuestById(id) {
  return state.quests.find((quest) => quest.id === id);
}

function colorForQuest(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 50%)`;
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  const step = 80;
  for (let x = 0; x < elements.canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, elements.canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < elements.canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(elements.canvas.width, y);
    ctx.stroke();
  }
}

function drawMap() {
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  ctx.fillStyle = "#0f1a17";
  ctx.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

  if (mapImage.complete && mapImage.naturalWidth) {
    ctx.drawImage(mapImage, 0, 0, elements.canvas.width, elements.canvas.height);
  }

  drawGrid();

  const questsForMap = state.quests.filter((quest) => quest.map === state.currentMap);
  questsForMap.forEach((quest) => {
    quest.points.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = colorForQuest(quest.id);
      ctx.arc(point.x, point.y, quest.id === state.selectedQuestId ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f1a17";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });

  ctx.fillStyle = "rgba(15, 26, 23, 0.7)";
  ctx.fillRect(16, elements.canvas.height - 48, 220, 32);
  ctx.fillStyle = "#fefcf6";
  ctx.font = "600 16px 'Space Grotesk', sans-serif";
  ctx.fillText(state.currentMap, 28, elements.canvas.height - 26);
}

function renderQuestList() {
  elements.questList.innerHTML = "";
  state.quests.forEach((quest) => {
    const item = document.createElement("div");
    item.className = "quest-item";
    if (quest.id === state.selectedQuestId) {
      item.classList.add("active");
    }
    if (quest.map !== state.currentMap) {
      item.classList.add("disabled");
    }

    const title = document.createElement("div");
    title.textContent = quest.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${quest.map} · ${quest.points.length} points`;

    item.appendChild(title);
    item.appendChild(meta);
    item.addEventListener("click", () => {
      if (quest.map !== state.currentMap) {
        return;
      }
      state.selectedQuestId = quest.id;
      saveState();
      render();
    });
    elements.questList.appendChild(item);
  });
}

function renderSelectedQuest() {
  elements.selectedQuest.innerHTML = "";
  const quest = getQuestById(state.selectedQuestId);
  if (!quest) {
    elements.selectedQuest.textContent = "Aucune quete selectionnee.";
    return;
  }

  const header = document.createElement("div");
  header.innerHTML = `<strong>${quest.name}</strong><div class="meta">${quest.map}</div>`;
  elements.selectedQuest.appendChild(header);

  if (!quest.points.length) {
    const empty = document.createElement("div");
    empty.textContent = "Clique sur la map pour ajouter un point.";
    elements.selectedQuest.appendChild(empty);
    return;
  }

  quest.points.forEach((point, index) => {
    const row = document.createElement("div");
    row.className = "point";
    const label = document.createElement("div");
    label.textContent = formatPoint(point);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", () => {
      quest.points.splice(index, 1);
      saveState();
      render();
    });
    row.appendChild(label);
    row.appendChild(remove);
    elements.selectedQuest.appendChild(row);
  });
}

function updateMapMessage() {
  const quest = getQuestById(state.selectedQuestId);
  if (!quest) {
    elements.mapMessage.textContent = "Selectionne une quete pour placer des points.";
    return;
  }
  if (quest.map !== state.currentMap) {
    elements.mapMessage.textContent = `Cette quete est liee a ${quest.map}. Change la map active.`;
    return;
  }
  elements.mapMessage.textContent = "Clique sur la map pour ajouter un point.";
}

function render() {
  elements.currentMap.value = state.currentMap;
  elements.questMap.value = state.currentMap;
  elements.mapPill.textContent = state.currentMap;
  renderQuestList();
  renderSelectedQuest();
  updateMapMessage();
  drawMap();
}

function handleMapClick(event) {
  const quest = getQuestById(state.selectedQuestId);
  if (!quest || quest.map !== state.currentMap) {
    return;
  }
  const rect = elements.canvas.getBoundingClientRect();
  const scaleX = elements.canvas.width / rect.width;
  const scaleY = elements.canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  quest.points.push({ x, y });
  saveState();
  render();
}

elements.questForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.questName.value.trim();
  const map = elements.questMap.value;
  if (!name) return;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.quests.unshift({ id, name, map, points: [] });
  state.selectedQuestId = id;
  state.currentMap = map;
  elements.questName.value = "";
  saveState();
  render();
});

elements.currentMap.addEventListener("change", (event) => {
  state.currentMap = event.target.value;
  saveState();
  render();
});

elements.canvas.addEventListener("click", handleMapClick);

mapImage.addEventListener("load", drawMap);

loadState();
populateSelects();
render();
