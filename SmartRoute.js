// SmartRoute.js
const $ = id => document.getElementById(id);
const pickupsContainer = $('pickupsContainer');
const addPickupBtn = $('addPickup');
const optimizeBtn = $('optimize');
const resultsDiv = $('results');
const linksDiv = $('links');
const clearBtn = $('clearAll');
const useLocationBtn = $('useLocation');
let pickupCount = 0;

function create(tag, cls){ const el = document.createElement(tag); if(cls) el.className = cls; return el; }

function haversine(a,b){
  const R = 6371000;
  const toRad = x => x*Math.PI/180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const hav = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(hav));
}

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

async function geocode(query){
  if(!query) throw new Error('Empty query');
  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1&addressdetails=0';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json();
  if(!data || data.length === 0) throw new Error('No results for: ' + query);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
}

function addPickup(value=''){
  pickupCount++;
  const id = 'pickup-' + pickupCount;
  const wrap = create('div', 'waypoint'); wrap.id = id + '-wrap';
  const input = create('input'); input.type='text'; input.placeholder='Pickup address (e.g. 123 Main St, City)'; input.value = value; input.id = id;
  const del = create('button'); del.textContent='✖'; del.title='Remove'; del.addEventListener('click', ()=> wrap.remove());
  wrap.appendChild(input); wrap.appendChild(del);
  pickupsContainer.appendChild(wrap);
}

addPickup(); addPickup(); addPickup();
addPickupBtn.addEventListener('click', ()=> addPickup());

clearBtn.addEventListener('click', ()=>{
  $('start').value=''; $('end').value=''; pickupsContainer.innerHTML=''; pickupCount = 0;
  addPickup(); addPickup(); addPickup();
  resultsDiv
