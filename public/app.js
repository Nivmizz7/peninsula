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

const MAP_DETAIL_QUERY = `
  query MapDetail($name: [String!]!, $lang: LanguageCode!) {
    maps(name: $name, lang: $lang) {
      name
      normalizedName
      spawns {
        position {
          x
          y
        }
      }
      extracts {
        position {
          x
          y
        }
      }
      transits {
        position {
          x
          y
        }
      }
      switches {
        position {
          x
          y
        }
      }
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
  mapBoundsByNormalized: {},
  objectiveBoundsByNormalized: {},
  svgMapRect: null,
  svgViewBox: null,
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
  taskSelect.appendChild(createOption("", "Add a quest..."));
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
    selectedTasksEl.innerHTML = "<div class=\"status-text\">No quests selected.</div>";
    return;
  }

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

function computeSvgMapRect(svgElement) {
  if (!svgElement) {
    return null;
  }

  const viewBox = svgElement.viewBox?.baseVal;
  const viewBoxRect = viewBox
    ? { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }
    : { x: 0, y: 0, width: svgElement.clientWidth || 1, height: svgElement.clientHeight || 1 };

  const borders = svgElement.querySelectorAll(".map_border");
  if (!borders.length) {
    return { mapRect: viewBoxRect, viewBox: viewBoxRect };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  borders.forEach((border) => {
    try {
      const box = border.getBBox();
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    } catch (error) {
      // Some SVG nodes may not support getBBox.
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { mapRect: viewBoxRect, viewBox: viewBoxRect };
  }

  const mapRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return { mapRect, viewBox: viewBoxRect };
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
        const rectData = computeSvgMapRect(svgElement);
        state.svgMapRect = rectData?.mapRect || null;
        state.svgViewBox = rectData?.viewBox || null;
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
  state.svgMapRect = null;
  state.svgViewBox = null;
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

function getPositionsFromMapDetail(mapDetail) {
  const positions = [];
  const buckets = [mapDetail.spawns, mapDetail.extracts, mapDetail.transits, mapDetail.switches];

  buckets.forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }
    collection.forEach((item) => {
      const pos = item?.position;
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        positions.push({ x: pos.x, y: pos.y });
      }
    });
  });

  return positions;
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

function mergeBounds(primary, secondary) {
  if (!primary) {
    return secondary;
  }
  if (!secondary) {
    return primary;
  }
  const minX = Math.min(primary.minX, secondary.minX);
  const maxX = Math.max(primary.maxX, secondary.maxX);
  const minY = Math.min(primary.minY, secondary.minY);
  const maxY = Math.max(primary.maxY, secondary.maxY);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  return { minX, maxX, minY, maxY, xRange, yRange };
}

function buildObjectiveBoundsByMap(tasks) {
  const positionsByMap = {};
  tasks.forEach((task) => {
    task.objectives.forEach((objective) => {
      if (!objective.zones) {
        return;
      }
      objective.zones.forEach((zone) => {
        const mapName = zone.map?.normalizedName;
        const pos = zone.position;
        if (!mapName || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
          return;
        }
        if (!positionsByMap[mapName]) {
          positionsByMap[mapName] = [];
        }
        positionsByMap[mapName].push({ x: pos.x, y: pos.y });
      });
    });
  });

  const boundsByMap = {};
  Object.entries(positionsByMap).forEach(([mapName, positions]) => {
    const bounds = computeBoundsFromPositions(positions);
    if (bounds) {
      boundsByMap[mapName] = bounds;
    }
  });
  return boundsByMap;
}

async function loadMapBounds(map) {
  if (!map) {
    return;
  }

  const cached = state.mapBoundsByNormalized[map.normalizedName];
  if (cached) {
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
    const objectiveBounds = state.objectiveBoundsByNormalized[map.normalizedName];
    const merged = mergeBounds(bounds, objectiveBounds);
    if (merged) {
      state.mapBoundsByNormalized[map.normalizedName] = merged;
    }
  } catch (error) {
    // Bounds are optional; fall back to objective-relative positions.
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

  const mapAssetPath = await loadMapAsset(map.normalizedName);
  mapSubtitle.textContent = `Map loaded: ${mapAssetPath}`;

  await loadMapBounds(map);

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
  const bounds = state.mapBoundsByNormalized[state.selectedMapNormalized];
  const fallbackBounds = computeBoundsFromPositions(
    zones.map((zone) => ({ x: zone.position.x, y: zone.position.y }))
  );
  const resolvedBounds = bounds || fallbackBounds;
  const viewBox = state.svgViewBox || { x: 0, y: 0, width: 1, height: 1 };
  const mapRect = state.svgMapRect || viewBox;

  zones.forEach((zone) => {
    const xLocal = (zone.position.x - resolvedBounds.minX) / resolvedBounds.xRange;
    const yLocal = (zone.position.y - resolvedBounds.minY) / resolvedBounds.yRange;

    const xSvg = mapRect.x + xLocal * mapRect.width;
    const ySvg = mapRect.y + yLocal * mapRect.height;

    const xPercent = ((xSvg - viewBox.x) / viewBox.width) * 100;
    const yPercent = ((ySvg - viewBox.y) / viewBox.height) * 100;
    const floorIndex = zoneFloorIndex(zone, state.floors);
    const onSelectedFloor = floorIndex === state.selectedFloorIndex;

    const marker = document.createElement("div");
    marker.className = `marker ${onSelectedFloor ? "red" : "black"}`;
    marker.style.left = `${xPercent}%`;
    marker.style.top = `${yPercent}%`;

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
    setStatus("Loading maps...");
    const [mapsData, tasksData] = await Promise.all([
      fetchGraphQL(MAPS_QUERY, { lang: LANG }),
      fetchGraphQL(TASKS_QUERY, { lang: LANG }),
    ]);

    state.maps = mapsData.maps;
    state.tasks = tasksData.tasks;
    state.objectiveBoundsByNormalized = buildObjectiveBoundsByMap(state.tasks);

    renderMapOptions();
    renderTaskOptions();
    renderSelectedTasks();
    await setMapSelection(state.maps[0]?.id);

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
