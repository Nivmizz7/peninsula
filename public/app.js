const API_URL = "https://api.tarkov.dev/graphql";
const LANG = "en";

const TASKS_QUERY = `
  query Tasks($lang: LanguageCode!) {
    tasks(lang: $lang) {
      id
      name
      map {
        id
        name
        normalizedName
      }
      objectives {
        __typename
        ... on TaskObjectiveBasic {
          id
          description
          maps { name normalizedName }
          zones {
            id
            map { name normalizedName }
            position { x y z }
            top
            bottom
          }
        }
        ... on TaskObjectiveMark {
          id
          description
          maps { name normalizedName }
          zones {
            id
            map { name normalizedName }
            position { x y z }
            top
            bottom
          }
        }
        ... on TaskObjectiveItem {
          id
          description
          maps { name normalizedName }
          zones {
            id
            map { name normalizedName }
            position { x y z }
            top
            bottom
          }
        }
        ... on TaskObjectiveQuestItem {
          id
          description
          maps { name normalizedName }
          zones {
            id
            map { name normalizedName }
            position { x y z }
            top
            bottom
          }
        }
        ... on TaskObjectiveUseItem {
          id
          description
          maps { name normalizedName }
          zones {
            id
            map { name normalizedName }
            position { x y z }
            top
            bottom
          }
        }
        ... on TaskObjectiveExtract {
          id
          description
          maps { name normalizedName }
          zoneNames
        }
      }
    }
  }
`;

const MAPS_QUERY = `
  query Maps($lang: LanguageCode!) {
    maps(lang: $lang) {
      id
      name
      normalizedName
    }
  }
`;

const MAP_DETAIL_QUERY = `
  query MapDetail($name: [String!]!, $lang: LanguageCode!) {
    maps(name: $name, lang: $lang) {
      name
      normalizedName
      spawns { position { x y z } }
      extracts { position { x y z } }
      transits { position { x y z } }
      switches { position { x y z } }
    }
  }
`;

const MAP_ASSET_OVERRIDES = {
  customs: "Customs.svg",
  factory: "Factory.svg",
  "ground-zero": "GroundZero.svg",
  groundzero: "GroundZero.svg",
  interchange: "Interchange.svg",
  labs: "Labs.svg",
  lighthouse: "Lighthouse.svg",
  reserve: "Reserve.svg",
  shoreline: "Shoreline.svg",
  "streets-of-tarkov": "StreetsOfTarkov.svg",
  streetsoftarkov: "StreetsOfTarkov.svg",
  woods: "Woods.svg",
};

const state = {
  maps: [],
  tasks: [],
  selectedMapId: null,
  selectedMapNormalized: null,
  selectedTaskIds: new Set(),
  floors: [],
  selectedFloorIndex: 0,
  svgFloorIds: [],
  mapAssetType: "img",
  mapBoundsByNormalized: {},
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
const questDescription = document.getElementById("questDescription");

function setStatus(message) {
  statusText.textContent = message;
}

async function fetchGraphQL(query, variables) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    throw new Error(payload.errors.map((err) => err.message).join(" | "));
  }

  return payload.data;
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
    mapSelect.appendChild(createOption(map.id, map.name));
  });
}

function renderTaskOptions() {
  taskSelect.innerHTML = "";
  taskSelect.appendChild(createOption("", "Add a quest..."));
  const filteredTasks = state.selectedMapNormalized
    ? state.tasks.filter((task) => task.map?.normalizedName === state.selectedMapNormalized)
    : state.tasks;

  filteredTasks
    .filter((task) => !state.selectedTaskIds.has(task.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((task) => {
      taskSelect.appendChild(createOption(task.id, task.name));
    });
}

function renderSelectedTasks() {
  selectedTasksEl.innerHTML = "";
  const selected = state.tasks.filter((task) => state.selectedTaskIds.has(task.id));

  if (!selected.length) {
    selectedTasksEl.innerHTML = "<div class=\"status-text\">No quests selected.</div>";
    questDescription.textContent = "Select a quest to see details.";
    return;
  }

  const description = selected
    .map((task) => {
      const objectives = task.objectives
        .map((objective) => objective.description)
        .filter(Boolean)
        .join("\n");
      return `${task.name}\n${objectives}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
  questDescription.textContent = description || "No description provided.";

  selected.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-chip";
    button.textContent = task.name;
    button.title = "Click to remove";
    button.addEventListener("click", () => {
      state.selectedTaskIds.delete(task.id);
      renderSelectedTasks();
      renderTaskOptions();
      updateMapView();
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
      updateMarkers();
    });
    floorControls.appendChild(button);
  });
}

function mapAssetCandidates(normalizedName) {
  const candidates = [];
  const override = MAP_ASSET_OVERRIDES[normalizedName];
  if (override) {
    candidates.push(override);
  }
  const lower = normalizedName.toLowerCase();
  if (MAP_ASSET_OVERRIDES[lower]) {
    candidates.push(MAP_ASSET_OVERRIDES[lower]);
  }
  const title = normalizedName
    .split(/[^a-z0-9]/gi)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join("");
  if (title) {
    candidates.push(`${title}.svg`);
    candidates.push(`${title}.png`);
  }
  candidates.push(`${normalizedName}.svg`);
  candidates.push(`${normalizedName}.png`);
  return Array.from(new Set(candidates));
}

async function loadMapAsset(map) {
  if (!map) {
    return;
  }

  const normalizedName = map.normalizedName || map.name;
  const candidates = mapAssetCandidates(normalizedName || "");
  for (const candidate of candidates) {
    const path = `maps/${candidate}`;
    if (candidate.endsWith(".svg")) {
      try {
        const response = await fetch(path);
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
          return path;
        }
      } catch (error) {
        // Ignore and try next candidate.
      }
    }
  }

  mapSvg.style.display = "none";
  mapImage.style.display = "block";
  mapImage.src = "maps/placeholder.svg";
  state.mapAssetType = "img";
  state.svgFloorIds = [];
  state.selectedFloorIndex = 0;
  renderFloorControls();
  return "maps/placeholder.svg";
}

function getObjectiveZonesForMap(mapNormalized) {
  const selectedTasks = state.tasks.filter((task) => state.selectedTaskIds.has(task.id));
  const zones = [];

  selectedTasks.forEach((task) => {
    task.objectives.forEach((objective) => {
      if (!objective.zones) {
        return;
      }

      objective.zones.forEach((zone) => {
        const zoneMap = zone.map?.normalizedName;
        if (zoneMap && zoneMap === mapNormalized && zone.position) {
          zones.push({
            taskName: task.name,
            objective: objective.description,
            position: zone.position,
            plane: { x: zone.position.x, y: zone.position.z },
            top: zone.top,
            bottom: zone.bottom,
          });
        }
      });
    });
  });

  return zones;
}

function getZoneZ(zone) {
  const directZ = zone.position?.y;
  if (Number.isFinite(directZ)) {
    return directZ;
  }

  if (Number.isFinite(zone.top) && Number.isFinite(zone.bottom)) {
    return (zone.top + zone.bottom) / 2;
  }

  return 0;
}

function computeFloors(zones) {
  const svgFloorCount = state.svgFloorIds.length;
  if (!zones.length) {
    if (svgFloorCount) {
      return state.svgFloorIds.map((id, index) => ({
        label: labelForFloorId(id, index),
        min: -Infinity,
        max: Infinity,
        svgId: id,
      }));
    }
    return [{ label: "Single floor", min: -Infinity, max: Infinity }];
  }

  const zValues = zones.map((zone) => getZoneZ(zone));
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  if (Math.abs(maxZ - minZ) < 0.01) {
    if (svgFloorCount) {
      return state.svgFloorIds.map((id, index) => ({
        label: labelForFloorId(id, index),
        min: -Infinity,
        max: Infinity,
        svgId: id,
      }));
    }
    return [{ label: "Single floor", min: -Infinity, max: Infinity }];
  }

  const floorCount = svgFloorCount || 3;
  const step = (maxZ - minZ) / floorCount;

  return Array.from({ length: floorCount }, (_, index) => {
    const min = index === 0 ? minZ - 0.01 : minZ + step * index;
    const max = index === floorCount - 1 ? maxZ + 0.01 : minZ + step * (index + 1);
    const svgId = state.svgFloorIds[index];
    const label = svgId ? labelForFloorId(svgId, index) : `Floor ${index + 1}`;
    return { label, min, max, svgId };
  });
}

function zoneFloorIndex(zone, floors) {
  const z = getZoneZ(zone);
  const index = floors.findIndex((floor) => z >= floor.min && z <= floor.max);
  return index === -1 ? 0 : index;
}

function renderMapOptionsAndSelectFirst() {
  renderMapOptions();
  const firstMap = state.maps[0];
  if (firstMap) {
    setMapSelection(firstMap.id);
  }
}

function computeBoundsFromPositions(positions) {
  if (!positions.length) {
    return null;
  }
  const xs = positions.map((pos) => pos.x);
  const ys = positions.map((pos) => pos.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  return { minX, maxX, minY, maxY, xRange, yRange };
}

function getPositionsFromMapDetail(mapDetail) {
  const positions = [];
  const buckets = [mapDetail.spawns, mapDetail.extracts, mapDetail.transits, mapDetail.switches];

  buckets.forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }
    collection.forEach((item) => {
      const pos = item?.position;
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z)) {
        positions.push({ x: pos.x, y: pos.z });
      }
    });
  });

  return positions;
}

async function loadMapBounds(map) {
  if (!map) {
    return;
  }

  if (state.mapBoundsByNormalized[map.normalizedName]) {
    return;
  }

  try {
    const data = await fetchGraphQL(MAP_DETAIL_QUERY, { name: [map.name], lang: LANG });
    const mapDetail = data.maps?.[0];
    if (!mapDetail) {
      return;
    }

    const positions = getPositionsFromMapDetail(mapDetail);
    const bounds = computeBoundsFromPositions(positions);
    if (bounds) {
      state.mapBoundsByNormalized[map.normalizedName] = bounds;
    }
  } catch (error) {
    // Bounds optional.
  }
}

async function setMapSelection(mapId) {
  const map = state.maps.find((item) => item.id === mapId) || state.maps[0];
  if (!map) {
    return;
  }

  state.selectedMapId = map.id;
  state.selectedMapNormalized = map.normalizedName;
  mapSelect.value = map.id;
  mapTitle.textContent = map.name;
  mapSubtitle.textContent = "Loading map...";

  state.selectedTaskIds.forEach((taskId) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (task && task.map?.normalizedName !== map.normalizedName) {
      state.selectedTaskIds.delete(taskId);
    }
  });

  const mapAssetPath = await loadMapAsset(map);
  mapSubtitle.textContent = `Map loaded: ${mapAssetPath}`;

  await loadMapBounds(map);

  renderTaskOptions();
  renderSelectedTasks();
  updateMapView();
}

function updateMarkers() {
  markerLayer.innerHTML = "";

  const zones = getObjectiveZonesForMap(state.selectedMapNormalized);
  if (!zones.length) {
    mapEmpty.style.display = "flex";
    return;
  }

  mapEmpty.style.display = "none";
  const bounds = state.mapBoundsByNormalized[state.selectedMapNormalized];
  const fallbackBounds = computeBoundsFromPositions(zones.map((zone) => zone.plane));
  const resolvedBounds = bounds || fallbackBounds;

  zones.forEach((zone) => {
    const xLocal = (zone.plane.x - resolvedBounds.minX) / resolvedBounds.xRange;
    const yLocal = (zone.plane.y - resolvedBounds.minY) / resolvedBounds.yRange;
    const floorIndex = zoneFloorIndex(zone, state.floors);
    const onSelectedFloor = floorIndex === state.selectedFloorIndex;

    const marker = document.createElement("div");
    marker.className = `marker ${onSelectedFloor ? "red" : "black"}`;
    marker.style.left = `${xLocal * 100}%`;
    marker.style.top = `${(1 - yLocal) * 100}%`;

    const label = document.createElement("div");
    label.className = "marker-label";
    label.textContent = zone.objective || zone.taskName;
    marker.appendChild(label);

    markerLayer.appendChild(marker);
  });
}

function updateMapView() {
  const zones = getObjectiveZonesForMap(state.selectedMapNormalized);
  state.floors = computeFloors(zones);
  state.selectedFloorIndex = Math.min(state.selectedFloorIndex, state.floors.length - 1);
  renderFloorControls();
  applySvgFloorVisibility();
  updateMarkers();
}

async function init() {
  try {
    setStatus("Loading maps...");
    const [mapsData, tasksData] = await Promise.all([
      fetchGraphQL(MAPS_QUERY, { lang: LANG }),
      fetchGraphQL(TASKS_QUERY, { lang: LANG }),
    ]);

    state.maps = mapsData.maps || [];
    state.tasks = tasksData.tasks || [];

    renderMapOptionsAndSelectFirst();
    renderTaskOptions();
    renderSelectedTasks();

    setStatus(`Ready. ${state.tasks.length} quests loaded.`);
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

mapSelect.addEventListener("change", async (event) => {
  await setMapSelection(event.target.value);
});

taskSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    return;
  }
  state.selectedTaskIds.add(value);
  taskSelect.value = "";
  renderSelectedTasks();
  renderTaskOptions();
  updateMapView();
});

init();
