const state = {
  maps: [],
  selectedMap: null,
  selectedPoint: { x: 50, y: 50 },
  points: [],
  mapAssetType: "img",
};

const adminMapSelect = document.getElementById("adminMapSelect");
const adminMapTitle = document.getElementById("adminMapTitle");
const adminMapSubtitle = document.getElementById("adminMapSubtitle");
const adminMapFrame = document.getElementById("adminMapFrame");
const adminMapImage = document.getElementById("adminMapImage");
const adminMapSvg = document.getElementById("adminMapSvg");
const adminMarkerLayer = document.getElementById("adminMarkerLayer");
const questNameInput = document.getElementById("questName");
const questDescriptionInput = document.getElementById("questDescription");
const hoverTextInput = document.getElementById("hoverText");
const pointXInput = document.getElementById("pointX");
const pointYInput = document.getElementById("pointY");
const addPointButton = document.getElementById("addPoint");
const clearPointsButton = document.getElementById("clearPoints");
const pointList = document.getElementById("pointList");
const saveQuestButton = document.getElementById("saveQuest");
const adminStatus = document.getElementById("adminStatus");

function setStatus(message) {
  adminStatus.textContent = message;
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
  adminMapSelect.innerHTML = "";
  state.maps.forEach((map) => {
    adminMapSelect.appendChild(createOption(map.normalizedName, map.name));
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
      adminMapSvg.innerHTML = svgText;
      const svgElement = adminMapSvg.querySelector("svg");
      if (svgElement) {
        svgElement.setAttribute("width", "100%");
        svgElement.setAttribute("height", "100%");
        svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
      adminMapSvg.style.display = "block";
      adminMapImage.style.display = "none";
      state.mapAssetType = "svg";
      return;
    }
  }

  adminMapSvg.style.display = "none";
  adminMapImage.style.display = "block";
  adminMapImage.src = map.asset;
  adminMapImage.onerror = () => {
    adminMapImage.src = "maps/placeholder.svg";
  };
  state.mapAssetType = "img";
}

function setMapSelection(normalizedName) {
  const map = state.maps.find((item) => item.normalizedName === normalizedName) || state.maps[0];
  if (!map) {
    return;
  }

  state.selectedMap = map;
  adminMapSelect.value = map.normalizedName;
  adminMapTitle.textContent = map.name;
  adminMapSubtitle.textContent = `Map loaded: ${map.asset}`;
  loadMapAsset(map);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updatePointInputs() {
  pointXInput.value = state.selectedPoint.x.toFixed(1);
  pointYInput.value = state.selectedPoint.y.toFixed(1);
}

function renderMarker() {
  adminMarkerLayer.innerHTML = "";
  state.points.forEach((point) => {
    const marker = document.createElement("div");
    marker.className = "marker red";
    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
    adminMarkerLayer.appendChild(marker);
  });

  const preview = document.createElement("div");
  preview.className = "marker";
  preview.style.left = `${state.selectedPoint.x}%`;
  preview.style.top = `${state.selectedPoint.y}%`;
  adminMarkerLayer.appendChild(preview);
}

function renderPointList() {
  pointList.innerHTML = "";
  if (!state.points.length) {
    pointList.innerHTML = "<div class=\"status-text\">No points added.</div>";
    return;
  }

  state.points.forEach((point, index) => {
    const item = document.createElement("div");
    item.className = "point-item";
    item.textContent = `${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "point-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.points.splice(index, 1);
      renderPointList();
      renderMarker();
    });

    item.appendChild(remove);
    pointList.appendChild(item);
  });
}

function setPointFromClick(event) {
  const rect = adminMapFrame.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  state.selectedPoint = {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
  updatePointInputs();
  renderMarker();
}

function setPointFromInputs() {
  const x = parseFloat(pointXInput.value);
  const y = parseFloat(pointYInput.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }
  state.selectedPoint = {
    x: clamp(x, 0, 100),
    y: clamp(y, 0, 100),
  };
  renderMarker();
}

function addPoint() {
  state.points.push({ ...state.selectedPoint });
  renderPointList();
  renderMarker();
}

function clearPoints() {
  state.points = [];
  renderPointList();
  renderMarker();
}

async function saveQuest() {
  const name = questNameInput.value.trim();
  const hoverText = hoverTextInput.value.trim();
  const description = questDescriptionInput.value.trim();
  if (!name || !state.selectedMap) {
    setStatus("Quest name and map are required.");
    return;
  }
  if (!state.points.length) {
    setStatus("Add at least one point.");
    return;
  }

  try {
    setStatus("Saving...");
    await fetchJson("/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        map: state.selectedMap.normalizedName,
        points: state.points,
        hoverText,
        description,
      }),
    });
    questNameInput.value = "";
    questDescriptionInput.value = "";
    hoverTextInput.value = "";
    state.points = [];
    renderPointList();
    renderMarker();
    setStatus("Quest saved.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

async function init() {
  try {
    setStatus("Loading maps...");
    const data = await fetchJson("/api/maps");
    state.maps = data.maps || [];
    renderMapOptions();
    if (state.maps.length) {
      setMapSelection(state.maps[0].normalizedName);
    }
    updatePointInputs();
    renderPointList();
    renderMarker();
    setStatus("Ready.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

adminMapSelect.addEventListener("change", (event) => {
  setMapSelection(event.target.value);
});

adminMapFrame.addEventListener("click", (event) => {
  setPointFromClick(event);
});

pointXInput.addEventListener("change", setPointFromInputs);
pointYInput.addEventListener("change", setPointFromInputs);
addPointButton.addEventListener("click", addPoint);
clearPointsButton.addEventListener("click", clearPoints);
saveQuestButton.addEventListener("click", saveQuest);

init();
