const apiKey = 'X8kg4tGNBNy9AViJ3J8cSw4hl2idyGoR';
let darkMode = false;
let tileLayer;

const map = L.map('map').setView([12.9716, 77.5946], 13);
loadTileLayer();

function loadTileLayer() {
  if (tileLayer) map.removeLayer(tileLayer);
  const style = darkMode ? 'night' : 'main';
  tileLayer = L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/${style}/{z}/{x}/{y}.png?key=${apiKey}`, {
    maxZoom: 19,
    attribution: '&copy; TomTom'
  }).addTo(map);
}

let startCoords = null, endCoords = null;
let routeLine = null, startMarker = null, endMarker = null;
let clickCount = 0;

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.6/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.6/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

async function reverseGeocode(lat, lon) {
  const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.addresses?.[0]?.address?.freeformAddress || '';
}

async function geocodeAddress(address) {
  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results?.[0]?.position;
}

async function handleInput(inputId, type) {
  const val = document.getElementById(inputId).value.trim();
  const coordsDiv = document.getElementById(type + 'Coords');

  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(val)) {
    const [lat, lon] = val.split(',').map(Number);
    const address = await reverseGeocode(lat, lon);
    coordsDiv.innerText = `Lat: ${lat}, Lon: ${lon}`;
    document.getElementById(inputId).value = address;
    if (type === 'start') startCoords = { lat, lon };
    else endCoords = { lat, lon };
  } else {
    const pos = await geocodeAddress(val);
    if (pos) {
      coordsDiv.innerText = `Lat: ${pos.lat}, Lon: ${pos.lon}`;
      if (type === 'start') startCoords = pos;
      else endCoords = pos;
    } else {
      coordsDiv.innerText = "Location not found";
    }
  }
}

document.getElementById('startInput').addEventListener('blur', () => handleInput('startInput', 'start'));
document.getElementById('endInput').addEventListener('blur', () => handleInput('endInput', 'end'));

async function calculateRoute(start = startCoords, end = endCoords) {
  if (!start || !end) {
    document.getElementById('info').innerText = "Both locations are required.";
    return;
  }

  [startMarker, endMarker, routeLine].forEach(layer => layer && map.removeLayer(layer));
  startMarker = L.marker([start.lat, start.lon], { icon: greenIcon }).addTo(map).bindPopup("🚀 Source").openPopup();
  endMarker = L.marker([end.lat, end.lon], { icon: redIcon }).addTo(map).bindPopup("🏁 Destination").openPopup();

  const departTime = document.getElementById('datetime').value;
  const departAt = departTime ? `&departAt=${new Date(departTime).toISOString()}` : '';

  const routeURL = `https://api.tomtom.com/routing/1/calculateRoute/${start.lat},${start.lon}:${end.lat},${end.lon}/json?key=${apiKey}&traffic=true${departAt}`;
  document.getElementById('info').innerText = "Calculating route...";

  try {
    const res = await fetch(routeURL);
    const data = await res.json();
    if (!data.routes?.length) {
      document.getElementById('info').innerText = "No route found.";
      return;
    }

    const route = data.routes[0];
    const points = route.legs[0].points.map(p => [p.latitude, p.longitude]);
    routeLine = L.polyline(points, { color: '#007bff' }).addTo(map);
    map.fitBounds(routeLine.getBounds());

    const dist = (route.summary.lengthInMeters / 1000).toFixed(2);
    const eta = (route.summary.travelTimeInSeconds / 60).toFixed(1);
    document.getElementById('info').innerHTML = `
      <b>Route Info:</b><br>
      Distance: ${dist} km<br>
      ETA: ${eta} min<br>
      Traffic based on: ${departTime ? new Date(departTime).toLocaleString() : 'Now'}
    `;

    // Save user history for route
    saveUserHistory("some_user_id", "route", `Start: ${start.lat}, ${start.lon} End: ${end.lat}, ${end.lon} ETA: ${eta} min`);

  } catch (e) {
    document.getElementById('info').innerText = "Error calculating route.";
  }
}

function resetMap() {
  [routeLine, startMarker, endMarker].forEach(layer => layer && map.removeLayer(layer));
  ['startInput', 'endInput'].forEach(id => document.getElementById(id).value = '');
  ['startCoords', 'endCoords'].forEach(id => document.getElementById(id).innerText = '');
  document.getElementById('info').innerText = 'Enter locations or lat/lon, or click on map.';
  startCoords = endCoords = null;
  clickCount = 0;
}

map.on('click', async e => {
  const { lat, lng } = e.latlng;
  const address = await reverseGeocode(lat, lng);
  if (clickCount === 0) {
    startCoords = { lat, lon: lng };
    document.getElementById('startInput').value = address;
    document.getElementById('startCoords').innerText = `Lat: ${lat}, Lon: ${lng}`;
    document.getElementById('info').innerText = "Start selected. Click again to set end.";
    clickCount++;
  } else {
    endCoords = { lat, lon: lng };
    document.getElementById('endInput').value = address;
    document.getElementById('endCoords').innerText = `Lat: ${lat}, Lon: ${lng}`;
    clickCount = 0;
    calculateRoute();
  }
});

function toggleTheme() {
  darkMode = !darkMode;
  document.body.classList.toggle('dark', darkMode);
  loadTileLayer();
}

// Floating behavior
const controls = document.getElementById("controls");
let isDragging = false, offsetX, offsetY;

controls.addEventListener("mousedown", e => {
  isDragging = true;
  offsetX = e.clientX - controls.offsetLeft;
  offsetY = e.clientY - controls.offsetTop;
});

document.addEventListener("mouseup", () => isDragging = false);

document.addEventListener("mousemove", e => {
  if (isDragging) {
    controls.style.left = `${e.clientX - offsetX}px`;
    controls.style.top = `${e.clientY - offsetY}px`;
  }
});

const weatherApiKey = '6efb29efee2b4ba988c155930251804';

function toggleWeatherPanel() {
  const panel = document.getElementById('weatherPanel');
  panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}

async function fetchWeather() {
  const location = document.getElementById('weatherLocation').value.trim();
  const date = document.getElementById('weatherDate').value;

  if (!location || !date) {
    alert("Please enter both location and date.");
    return;
  }

  const forecastUrl = `https://api.weatherapi.com/v1/history.json?key=${weatherApiKey}&q=${encodeURIComponent(location)}&dt=${date}`;

  try {
    const res = await fetch(forecastUrl);
    const data = await res.json();

    if (!data || !data.forecast) {
      document.getElementById('weatherInfo').innerHTML = "No weather data found.";
      return;
    }

    const day = data.forecast.forecastday[0].day;

    document.getElementById('weatherInfo').innerHTML = `
      <h4>${data.location.name}, ${data.location.region}</h4>
      <p><strong>Date:</strong> ${date}</p>
      <p><img class="weather-icon" src="https:${day.condition.icon}" /> <strong>${day.condition.text}</strong></p>
      <p>🌡️ Avg Temp: ${day.avgtemp_c}°C</p>
      <p>💧 Humidity: ${day.avghumidity}%</p>
      <p>🌧️ Chance of Rain: ${day.daily_chance_of_rain}%</p>
    `;

    // Save user history for weather
    saveUserHistory("some_user_id", "weather", `Location: ${location} Date: ${date} Condition: ${day.condition.text}`);

  } catch (error) {
    document.getElementById('weatherInfo').innerHTML = "Failed to fetch weather data.";
    console.error(error);
  }
}

async function saveUserHistory(user_id, query_type, query_data) {
  try {
    const response = await fetch('/save_history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id, query_type, query_data }),
    });

    if (!response.ok) {
      console.error("Error saving history");
    }
  } catch (error) {
    console.error("Error sending history to backend:", error);
  }
}
