/* SmartRoute.js
   Single-purpose app:
   - geocodes addresses via OpenStreetMap Nominatim (no API key)
   - finds best pickup order (brute-force permutations, Haversine distance)
   - displays route on Leaflet map and provides Google Maps directions links
*/

// Simple helpers
const $ = id => document.getElementById(id);
const pickupsContainer = $('pickupsContainer');
const addPickupBtn = $('addPickup');
const optimizeBtn = $('optimize');
const resultsDiv = $('results');
const linksDiv = $('links');
const clearBtn = $('clearAll');
const useLocationBtn = $('useLocation');
let pickupCount = 0;

// DOM create helper
function create(tag, cls){ const el = document.createElement(tag); if(cls) el.className = cls; return el; }

// Haversine (meters)
function haversine(a,b){
  const R = 6371000;
  const toRad = x => x*Math.PI/180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const hav = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(hav));
}

// Permutations
function permutations(arr){
  const out = [];
  function perm(curr, rest){
    if(rest.length === 0){ out.push(curr.slice()); return; }
    for(let i=0;i<rest.length;i++){
      const next = rest[i];
      const r = rest.slice(0,i).concat(rest.slice(i+1));
      curr.push(next);
      perm(curr, r);
      curr.pop();
    }
  }
  perm([], arr);
  return out;
}

// Geocode (Nominatim)
async function geocode(query){
  if(!query) throw new Error('Empty query');
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1&addressdetails=0';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  if(!data || data.length === 0) throw new Error('No results for: ' + query);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
}

// UI: add pickup input
function addPickup(value=''){
  pickupCount++;
  const id = 'pickup-' + pickupCount;
  const wrap = create('div', 'waypoint'); wrap.id = id + '-wrap';
  const input = create('input'); input.type='text'; input.placeholder='Pickup address (e.g. 123 Main St, City)'; input.value = value; input.id = id;
  const del = create('button'); del.textContent='✖'; del.title='Remove'; del.addEventListener('click', ()=> wrap.remove());
  wrap.appendChild(input); wrap.appendChild(del);
  pickupsContainer.appendChild(wrap);
}

// start with 3 pickups
addPickup(); addPickup(); addPickup();
addPickupBtn.addEventListener('click', ()=> addPickup());

// Clear button
clearBtn.addEventListener('click', ()=>{
  $('start').value=''; $('end').value=''; pickupsContainer.innerHTML=''; pickupCount = 0;
  addPickup(); addPickup(); addPickup();
  resultsDiv.innerHTML=''; linksDiv.innerHTML=''; clearMap();
});

// Use browser geolocation for start
useLocationBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ alert('Geolocation not supported'); return; }
  useLocationBtn.textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(pos => {
    $('start').value = pos.coords.latitude + ',' + pos.coords.longitude;
    useLocationBtn.textContent = 'Use my location';
    map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    addMarker({lat:pos.coords.latitude, lon:pos.coords.longitude}, 'Your location');
  }, err => {
    alert('Could not get location: ' + err.message);
    useLocationBtn.textContent = 'Use my location';
  });
});

// Leaflet map
const map = L.map('map', { zoomControl: true }).setView([43.32, -79.80], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);

let markers = [];
let polyline = null;
function addMarker(pt, label){
  const m = L.marker([pt.lat, pt.lon]).addTo(map).bindPopup(label || pt.name || '');
  markers.push(m);
}
function clearMap(){
  markers.forEach(m => m.remove());
  markers = [];
  if(polyline) polyline.remove();
  polyline = null;
}

// Main optimize action
optimizeBtn.addEventListener('click', async ()=>{
  resultsDiv.innerHTML = 'Working...';
  linksDiv.innerHTML = '';
  clearMap();

  try {
    const startRaw = $('start').value.trim();
    const endRaw = $('end').value.trim();
    if(!endRaw) throw new Error('Please enter final drop-off (school) address.');
    const pickupInputs = Array.from(pickupsContainer.querySelectorAll('input')).map(i=>i.value.trim()).filter(v=>v.length>0);
    if(pickupInputs.length === 0) throw new Error('Please enter at least one pickup address.');
    if(pickupInputs.length > 8) { if(!confirm('More than 8 pickups may be very slow. Continue?')) return; }

    // start point handling
    let startPoint = null;
    if(startRaw === ''){
      resultsDiv.innerHTML = 'No start entered — trying browser geolocation...';
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      startPoint = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Your location' };
    } else if(/^\s*-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?\s*$/.test(startRaw)){
      const [lat, lon] = startRaw.split(',').map(s => parseFloat(s.trim()));
      startPoint = { lat, lon, name: 'Start' };
    } else {
      resultsDiv.innerHTML = 'Geocoding start...';
      startPoint = await geocode(startRaw);
    }

    // geocode pickups
    resultsDiv.innerHTML = 'Geocoding pickups...';
    const pickupPoints = [];
    for(const p of pickupInputs){
      try {
        const g = await geocode(p);
        pickupPoints.push(g);
      } catch(e){
        throw new Error('Could not geocode pickup: ' + p + ' — ' + e.message);
      }
    }

    // geocode end
    resultsDiv.innerHTML = 'Geocoding final destination...';
    let endPoint;
    if(/^\s*-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?\s*$/.test(endRaw)){
      const [lat, lon] = endRaw.split(',').map(s => parseFloat(s.trim()));
      endPoint = { lat, lon, name: 'End' };
    } else {
      endPoint = await geocode(endRaw);
    }

    // permutations and scoring
    resultsDiv.innerHTML = 'Calculating best order...';
    const perms = permutations(pickupPoints.map((p,i)=>i));
    let best = null;
    let bestOrder = null;
    for(const perm of perms){
      let total = 0;
      let prev = startPoint;
      for(const idx of perm){
        const pt = pickupPoints[idx];
        total += haversine(prev, {lat:pt.lat, lon:pt.lon});
        prev = { lat: pt.lat, lon: pt.lon };
      }
      total += haversine(prev, { lat: endPoint.lat, lon: endPoint.lon });
      if(best === null || total < best){
        best = total;
        bestOrder = perm.slice();
      }
    }

    // Build ordered list
    const ordered = [startPoint].concat(bestOrder.map(i => pickupPoints[i])).concat([endPoint]);

    // Show results
    resultsDiv.innerHTML = '<strong>Optimized order (approx)</strong><br><ol>' +
      ordered.slice(0,-1).map((pt,i) => `<li>${i===0? 'Start: ':'Pickup: '}${escapeHtml(pt.name || (pt.lat+','+pt.lon))}</li>`).join('') +
      `<li>Final drop-off: ${escapeHtml(endPoint.name)}</li></ol>` +
      `<div class="small">Total straight-line distance ≈ ${(best/1000).toFixed(2)} km</div>`;

    // Map
    ordered.forEach((pt, idx) => addMarker({lat:pt.lat, lon:pt.lon}, (idx===0?'Start': idx===ordered.length-1 ? 'Drop-off' : 'Pickup') + (pt.name ? '\n' + pt.name : '')));
    map.fitBounds(markers.map(m=>m.getLatLng()), { padding: [50,50] });
    polyline = L.polyline(ordered.map(p => [p.lat, p.lon]), { weight: 5, opacity: 0.85 }).addTo(map);

    // Google Maps directions links
    const gmapsBase = 'https://www.google.com/maps/dir/?api=1';
    const origin = `${startPoint.lat},${startPoint.lon}`;
    const destination = `${endPoint.lat},${endPoint.lon}`;
    const waypoints = bestOrder.map(i => `${pickupPoints[i].lat},${pickupPoints[i].lon}`).join('|');
    const gmaps = `${gmapsBase}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving${waypoints?('&waypoints=' + encodeURIComponent(waypoints)) : ''}`;
    const gmapsNames = `${gmapsBase}&origin=${encodeURIComponent(startPoint.name || origin)}&destination=${encodeURIComponent(endPoint.name || destination)}&travelmode=driving${bestOrder.length?('&waypoints=' + encodeURIComponent(bestOrder.map(i=>pickupPoints[i].name).join('|'))):''}`;

    linksDiv.innerHTML = `<a class="link" href="${gmaps}" target="_blank" rel="noreferrer noopener">Open directions in Google Maps (coords)</a>` +
                         `<a class="link" href="${gmapsNames}" target="_blank" rel="noreferrer noopener">Open directions in Google Maps (addresses)</a>`;

  } catch(err){
    resultsDiv.innerHTML = `<span style="color:#ffb4b4">Error: ${escapeHtml(err.message)}</span>`;
    console.error(err);
  }
});

// small utility to escape HTML in results
function escapeHtml(str){
  if(!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[s]));
}
