const API_URL = "https://api.tarkov.dev/graphql";
const LANG = "fr";

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
          type
          description
          maps {
            name
            normalizedName
          }
          zones {
            id
            map {
              name
              normalizedName
            }
            position {
              x
              y
              z
            }
            top
            bottom
          }
        }
        ... on TaskObjectiveMark {
          id
          type
          description
          maps {
            name
            normalizedName
          }
          zones {
            id
            map {
              name
              normalizedName
            }
            position {
              x
              y
              z
            }
            top
            bottom
          }
        }
        ... on TaskObjectiveItem {
          id
          type
          description
          maps {
            name
            normalizedName
          }
          zones {
            id
            map {
              name
              normalizedName
            }
            position {
              x
              y
              z
            }
            top
            bottom
          }
        }
        ... on TaskObjectiveQuestItem {
          id
          type
          description
          maps {
            name
            normalizedName
          }
          zones {
            id
            map {
              name
              normalizedName
            }
            position {
              x
              y
              z
            }
            top
            bottom
          }
        }
        ... on TaskObjectiveUseItem {
          id
          type
          description
          maps {
            name
            normalizedName
          }
          zones {
            id
            map {
              name
              normalizedName
            }
            position {
              x
              y
              z
            }
            top
            bottom
          }
        }
        ... on TaskObjectiveExtract {
          id
          type
          description
          maps {
            name
            normalizedName
          }
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

async function fetchGraphQL(query, variables) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Erreur API: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors) {
    throw new Error(payload.errors.map((err) => err.message).join(" | "));
  }

  return payload.data;
}

function mapImagePath(normalizedName) {
  return `maps/${normalizedName}.png`;
}

function mapSvgPath(name) {
  return `maps/${name}.svg`;
}

function capitalize(value) {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
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
  taskSelect.appendChild(createOption("", "Ajouter une quete..."));
  const filteredTasks = state.selectedMapNormalized
    ? state.tasks.filter((task) => task.map?.normalizedName === state.selectedMapNormalized)
    : state.tasks;

  filteredTasks
    .filter((task) => !state.selectedTaskIds.has(task.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((task) => {
      const label = task.map ? `${task.name} (${task.map.name})` : task.name;
      taskSelect.appendChild(createOption(task.id, label));
    });
}

function renderSelectedTasks() {
  selectedTasksEl.innerHTML = "";
  const selected = state.tasks.filter((task) => state.selectedTaskIds.has(task.id));

  if (!selected.length) {
    selectedTasksEl.innerHTML = "<div class=\"status-text\">Aucune quete selectionnee.</div>";
    return;
  }

  selected.forEach((task) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "task-chip";
    button.textContent = task.name;
    button.title = "Cliquer pour retirer";
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
    Basement: "Sous-sol",
    Ground_Floor: "RDC",
    First_Floor: "Etage 1",
    Second_Floor: "Etage 2",
    Third_Floor: "Etage 3",
  };
  return mapping[id] || `Etage ${index + 1}`;
}

async function loadMapAsset(normalizedName) {
  const svgCandidates = [normalizedName, capitalize(normalizedName)].filter(Boolean);
  for (const candidate of svgCandidates) {
    try {
      const response = await fetch(mapSvgPath(candidate));
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
        return `maps/${candidate}.svg`;
      }
    } catch (error) {
      // Ignore and fallback to raster assets.
    }
  }

  mapSvg.style.display = "none";
  mapImage.style.display = "block";
  state.mapAssetType = "img";
  state.svgFloorIds = [];
  return mapImagePath(normalizedName);
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

async function setMapSelection(mapId) {
  const map = state.maps.find((item) => item.id === mapId) || state.maps[0];
  if (!map) {
    return;
  }

  state.selectedMapId = map.id;
  state.selectedMapNormalized = map.normalizedName;
  mapSelect.value = map.id;
  mapTitle.textContent = map.name;
  mapSubtitle.textContent = "Chargement de la map...";

  const mapAssetPath = await loadMapAsset(map.normalizedName);
  mapSubtitle.textContent = `Carte chargee: ${mapAssetPath}`;

  if (state.mapAssetType === "img") {
    mapImage.src = mapAssetPath;
    mapImage.onerror = () => {
      mapImage.src = "maps/placeholder.svg";
    };
  }

  renderTaskOptions();
  updateMapView();
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
  const directZ = zone.position?.z;
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
    return [{ label: "Etage unique", min: -Infinity, max: Infinity }];
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
    return [{ label: "Etage unique", min: -Infinity, max: Infinity }];
  }

  const floorCount = svgFloorCount || 3;
  const step = (maxZ - minZ) / floorCount;

  return Array.from({ length: floorCount }, (_, index) => {
    const min = index === 0 ? minZ - 0.01 : minZ + step * index;
    const max = index === floorCount - 1 ? maxZ + 0.01 : minZ + step * (index + 1);
    const svgId = state.svgFloorIds[index];
    const label = svgId ? labelForFloorId(svgId, index) : `Etage ${index + 1}`;
    return { label, min, max, svgId };
  });
}

function zoneFloorIndex(zone, floors) {
  const z = getZoneZ(zone);
  const index = floors.findIndex((floor) => z >= floor.min && z <= floor.max);
  return index === -1 ? 0 : index;
}

function renderFloorControls() {
  floorControls.innerHTML = "";
  state.floors.forEach((floor, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `floor-btn ${index === state.selectedFloorIndex ? "active" : ""}`;
    button.textContent = floor.label;
    button.addEventListener("click", () => {
      state.selectedFloorIndex = index;
      renderFloorControls();
      applySvgFloorVisibility();
      updateMarkers();
    });
    floorControls.appendChild(button);
  });
}

function updateMarkers() {
  markerLayer.innerHTML = "";

  const zones = getObjectiveZonesForMap(state.selectedMapNormalized);
  if (!zones.length) {
    mapEmpty.style.display = "flex";
    return;
  }

  mapEmpty.style.display = "none";
  const xValues = zones.map((zone) => zone.position.x);
  const yValues = zones.map((zone) => zone.position.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  zones.forEach((zone) => {
    const xPercent = ((zone.position.x - minX) / xRange) * 100;
    const yPercent = ((zone.position.y - minY) / yRange) * 100;
    const floorIndex = zoneFloorIndex(zone, state.floors);
    const onSelectedFloor = floorIndex === state.selectedFloorIndex;

    const marker = document.createElement("div");
    marker.className = `marker ${onSelectedFloor ? "red" : "black"}`;
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${100 - yPercent}%`;

    const label = document.createElement("div");
    label.className = "marker-label";
    label.textContent = zone.objective;
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
    setStatus("Chargement des maps...");
    const [mapsData, tasksData] = await Promise.all([
      fetchGraphQL(MAPS_QUERY, { lang: LANG }),
      fetchGraphQL(TASKS_QUERY, { lang: LANG }),
    ]);

    state.maps = mapsData.maps;
    state.tasks = tasksData.tasks;

    renderMapOptions();
    renderTaskOptions();
    renderSelectedTasks();
    await setMapSelection(state.maps[0]?.id);

    setStatus(`Pret. ${state.tasks.length} quetes chargees.`);
  } catch (error) {
    setStatus(`Erreur: ${error.message}`);
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
