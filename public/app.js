const state = {
  maps: [],
  questsByMap: {},
  selectedMap: null,
  selectedQuestIds: new Set(),
  mapAssetType: "img",
  svgFloorIds: [],
  selectedFloorIndex: 0,
};

const mapSelect = document.getElementById("mapSelect");
const taskSelect = document.getElementById("taskSelect");
const selectedTasksEl = document.getElementById("selectedTasks");
const statusText = document.getElementById("statusText");
const mapTitle = document.getElementById("mapTitle");
const mapSubtitle = document.getElementById("mapSubtitle");
const mapImage = document.getElementById("mapImage");
const mapSvg = document.getElementById("mapSvg");
const markerLayer = document.getElementById("markerLayer");
const mapEmpty = document.getElementById("mapEmpty");
const floorControls = document.getElementById("floorControls");

function setStatus(message) {
  statusText.textContent = message;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderMapOptions() {
  mapSelect.innerHTML = "";
  state.maps.forEach((map) => {
    mapSelect.appendChild(createOption(map.normalizedName, map.name));
  });
}

function renderQuestOptions() {
  taskSelect.innerHTML = "";
  taskSelect.appendChild(createOption("", "Add a quest..."));
  const quests = state.questsByMap[state.selectedMap?.normalizedName] || [];

  quests
    .filter((quest) => !state.selectedQuestIds.has(quest.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((quest) => {
      taskSelect.appendChild(createOption(quest.id, quest.name));
    });
}

function renderSelectedQuests() {
  selectedTasksEl.innerHTML = "";
  const quests = state.questsByMap[state.selectedMap?.normalizedName] || [];
  const selected = quests.filter((quest) => state.selectedQuestIds.has(quest.id));

  if (!selected.length) {
    selectedTasksEl.innerHTML = "<div class=\"status-text\">No quests selected.</div>";
    return;
  }

  selected.forEach((quest) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-chip";
    button.textContent = quest.name;
    button.title = "Click to remove";
    button.addEventListener("click", () => {
      state.selectedQuestIds.delete(quest.id);
      renderSelectedQuests();
      renderQuestOptions();
      updateMarkers();
    });
    selectedTasksEl.appendChild(button);
  });
}

function extractSvgFloorIds(svgElement) {
  if (!svgElement) {
    return [];
  }

  const knownOrder = ["Basement", "Ground_Floor", "First_Floor", "Second_Floor", "Third_Floor"];
  const topGroups = Array.from(svgElement.children).filter(
    (node) => node.tagName && node.tagName.toLowerCase() === "g" && node.id
  );

  const byId = new Map(topGroups.map((group) => [group.id, group]));
  const ordered = knownOrder.filter((id) => byId.has(id));
  return ordered.length ? ordered : topGroups.map((group) => group.id);
}

function labelForFloorId(id, index) {
  const mapping = {
    Basement: "Basement",
    Ground_Floor: "Ground",
    First_Floor: "Floor 1",
    Second_Floor: "Floor 2",
    Third_Floor: "Floor 3",
  };
  return mapping[id] || `Floor ${index + 1}`;
}

function applySvgFloorVisibility() {
  if (state.mapAssetType !== "svg") {
    return;
  }

  const svgElement = mapSvg.querySelector("svg");
  if (!svgElement || !state.svgFloorIds.length) {
    return;
  }

  state.svgFloorIds.forEach((id, index) => {
    const group = svgElement.querySelector(`#${CSS.escape(id)}`);
    if (group) {
      group.style.display = index === state.selectedFloorIndex ? "inline" : "none";
    }
  });
}

function renderFloorControls() {
  floorControls.innerHTML = "";
  if (!state.svgFloorIds.length) {
    floorControls.style.display = "none";
    return;
  }

  floorControls.style.display = "flex";
  state.svgFloorIds.forEach((id, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `floor-btn ${index === state.selectedFloorIndex ? "active" : ""}`;
    button.textContent = labelForFloorId(id, index);
    button.addEventListener("click", () => {
      state.selectedFloorIndex = index;
      renderFloorControls();
      applySvgFloorVisibility();
    });
    floorControls.appendChild(button);
  });
}

async function loadMapAsset(map) {
  if (!map) {
    return;
  }

  if (map.asset.endsWith(".svg")) {
    const response = await fetch(map.asset);
    if (response.ok) {
      const svgText = await response.text();
      mapSvg.innerHTML = svgText;
      const svgElement = mapSvg.querySelector("svg");
      if (svgElement) {
        svgElement.setAttribute("width", "100%");
        svgElement.setAttribute("height", "100%");
        svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
      mapSvg.style.display = "block";
      mapImage.style.display = "none";
      state.mapAssetType = "svg";
      state.svgFloorIds = extractSvgFloorIds(svgElement);
      state.selectedFloorIndex = 0;
      renderFloorControls();
      applySvgFloorVisibility();
      return;
    }
  }

  mapSvg.style.display = "none";
  mapImage.style.display = "block";
  mapImage.src = map.asset;
  mapImage.onerror = () => {
    mapImage.src = "maps/placeholder.svg";
  };
  state.mapAssetType = "img";
  state.svgFloorIds = [];
  state.selectedFloorIndex = 0;
  renderFloorControls();
}

async function setMapSelection(normalizedName) {
  const map = state.maps.find((item) => item.normalizedName === normalizedName) || state.maps[0];
  if (!map) {
    return;
  }

  state.selectedMap = map;
  mapSelect.value = map.normalizedName;
  mapTitle.textContent = map.name;
  mapSubtitle.textContent = `Map loaded: ${map.asset}`;

  await loadMapAsset(map);
  renderQuestOptions();
  renderSelectedQuests();
  updateMarkers();
}

async function loadQuestsForMap(normalizedName) {
  const data = await fetchJson(`/api/quests?map=${encodeURIComponent(normalizedName)}`);
  state.questsByMap[normalizedName] = data.quests || [];
}

function updateMarkers() {
  markerLayer.innerHTML = "";
  const mapName = state.selectedMap?.normalizedName;
  const quests = state.questsByMap[mapName] || [];
  const selected = quests.filter((quest) => state.selectedQuestIds.has(quest.id));

  if (!selected.length) {
    mapEmpty.style.display = "flex";
    return;
  }

  mapEmpty.style.display = "none";

  selected.forEach((quest) => {
    const marker = document.createElement("div");
    marker.className = "marker red";
    marker.style.left = `${quest.point.x}%`;
    marker.style.top = `${quest.point.y}%`;

    const label = document.createElement("div");
    label.className = "marker-label";
    label.textContent = quest.hoverText || quest.name;
    marker.appendChild(label);

    markerLayer.appendChild(marker);
  });
}

async function init() {
  try {
    setStatus("Loading maps...");
    const data = await fetchJson("/api/maps");
    state.maps = data.maps || [];

    renderMapOptions();
    if (state.maps.length) {
      await loadQuestsForMap(state.maps[0].normalizedName);
      await setMapSelection(state.maps[0].normalizedName);
    }

    setStatus("Ready.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

mapSelect.addEventListener("change", async (event) => {
  const value = event.target.value;
  await loadQuestsForMap(value);
  await setMapSelection(value);
});

taskSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    return;
  }
  state.selectedQuestIds.add(value);
  taskSelect.value = "";
  renderSelectedQuests();
  renderQuestOptions();
  updateMarkers();
});

init();
