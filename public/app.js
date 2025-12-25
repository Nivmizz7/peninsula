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
};

const mapSelect = document.getElementById("mapSelect");
const taskSelect = document.getElementById("taskSelect");
const selectedTasksEl = document.getElementById("selectedTasks");
const statusText = document.getElementById("statusText");
const mapTitle = document.getElementById("mapTitle");
const mapSubtitle = document.getElementById("mapSubtitle");
const mapImage = document.getElementById("mapImage");
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
  state.tasks
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
      updateMapView();
    });
    selectedTasksEl.appendChild(button);
  });
}

function setMapSelection(mapId) {
  const map = state.maps.find((item) => item.id === mapId) || state.maps[0];
  if (!map) {
    return;
  }

  state.selectedMapId = map.id;
  state.selectedMapNormalized = map.normalizedName;
  mapSelect.value = map.id;
  mapTitle.textContent = map.name;
  mapSubtitle.textContent = `Image attendue: maps/${map.normalizedName}.png`;

  mapImage.src = mapImagePath(map.normalizedName);
  mapImage.onerror = () => {
    mapImage.src = "maps/placeholder.svg";
  };

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
  if (!zones.length) {
    return [{ label: "Etage unique", min: -Infinity, max: Infinity }];
  }

  const zValues = zones.map((zone) => getZoneZ(zone));
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  if (Math.abs(maxZ - minZ) < 0.01) {
    return [{ label: "Etage unique", min: -Infinity, max: Infinity }];
  }

  const step = (maxZ - minZ) / 3;
  return [
    { label: "Bas", min: minZ - 0.01, max: minZ + step },
    { label: "Milieu", min: minZ + step, max: minZ + step * 2 },
    { label: "Haut", min: minZ + step * 2, max: maxZ + 0.01 },
  ];
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
    setMapSelection(state.maps[0]?.id);

    setStatus(`Pret. ${state.tasks.length} quetes chargees.`);
  } catch (error) {
    setStatus(`Erreur: ${error.message}`);
  }
}

mapSelect.addEventListener("change", (event) => {
  setMapSelection(event.target.value);
});

taskSelect.addEventListener("change", (event) => {
  const value = event.target.value;
  if (!value) {
    return;
  }
  state.selectedTaskIds.add(value);
  taskSelect.value = "";
  renderSelectedTasks();
  updateMapView();
});

init();
