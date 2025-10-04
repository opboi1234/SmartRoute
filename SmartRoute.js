// SmartRoute.js - Improved Version
window.addEventListener('load', () => {
  const $ = id => document.getElementById(id);
  let pickupCount = 0;
  const pickupsContainer = $('pickupsContainer');
  const addPickupBtn = $('addPickup');
  const optimizeBtn = $('optimize');
  const clearBtn = $('clearAll');
  const useLocationBtn = $('useLocation');
  const resultsDiv = $('results');
  const linksDiv = $('links');

  let map, markers = [], routeLine = null;
  let markerIcons = {};

  // Custom marker icons for start/pickup/drop-off
  function loadMarkerIcons() {
    markerIcons.start = L.icon({iconUrl:'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]});
    markerIcons.pickup = L.icon({iconUrl:'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]});
    markerIcons.dropoff = L.icon({iconUrl:'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png',iconSize:[25,41],iconAnchor:[12,41],popupAnchor:[1,-34]});
  }

  // Initialize map safely
  function initMap() {
    if (typeof L === 'undefined') {
      resultsDiv.innerHTML = '<span style="color:red">Error: Map library failed to load. Please refresh the page.</span>';
      return false;
    }
    const mapElement = $('map');
    if (!mapElement) {
      resultsDiv.innerHTML = '<span style="color:red">Map element not found.</span>';
      return false;
    }
    map = L.map('map').setView([43.32, -79.80], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    return true;
  }

  loadMarkerIcons();
  if (!initMap()) return;

  function addMarker(lat, lon, label, type='pickup'){
    const icon = markerIcons[type] || markerIcons.pickup;
    const m = L.marker([lat, lon], {icon}).addTo(map).bindPopup(label);
    markers.push(m);
  }

  function clearMap(){
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if(routeLine) map.removeLayer(routeLine);
    routeLine = null;
  }

  function createPickup(value=''){
    if (pickupCount >= 6) {
      alert('Maximum 6 pickups allowed');
      return;
    }
    pickupCount++;
    const div = document.createElement('div');
    div.className='waypoint';
    const input = document.createElement('input');
    input.type='text';
    input.placeholder='Pickup address';
    input.value = value;
    input.setAttribute('aria-label', 'Pickup address');
    input.autocomplete = 'on';
    const btn = document.createElement('button');
    btn.textContent='✖';
    btn.onclick=()=>{div.remove(); pickupCount--;}
    div.appendChild(input);
    div.appendChild(btn);
    pickupsContainer.appendChild(div);
    input.focus();
  }

  addPickupBtn.onclick = ()=>createPickup();

  clearBtn.onclick = ()=>{
    $('start').value=''; 
    $('end').value=''; 
    pickupsContainer.innerHTML=''; 
    pickupCount=0;
    for(let i=0;i<3;i++) createPickup();
    resultsDiv.innerHTML=''; 
    linksDiv.innerHTML=''; 
    clearMap();
  };

  useLocationBtn.onclick = ()=>{
    if(!navigator.geolocation) return alert('Geolocation not supported');
    useLocationBtn.disabled = true;
    useLocationBtn.textContent = 'Locating...';
    navigator.geolocation.getCurrentPosition(pos=>{
      $('start').value=`${pos.coords.latitude},${pos.coords.longitude}`;
      map.setView([pos.coords.latitude,pos.coords.longitude],12);
      addMarker(pos.coords.latitude,pos.coords.longitude,'Your location','start');
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my location';
    }, err => {
      alert('Failed to get location: '+err.message);
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my location';
    });
  };

  async function geocode(address){
    // Accept "lat,lon" directly
    if (/^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(address)) {
      const [lat, lon] = address.split(',').map(x=>parseFloat(x));
      return {lat, lon, name:`${lat},${lon}`};
    }
    // Otherwise use Nominatim
    const url=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.length) throw new Error('Address not found: '+address);
    return {lat:parseFloat(data[0].lat), lon:parseFloat(data[0].lon), name:data[0].display_name};
  }

  function distance(a,b){
    const R=6371000;
    const rad=x=>x*Math.PI/180;
    const dLat = rad(b.lat-a.lat), dLon = rad(b.lon-a.lon);
    const lat1=rad(a.lat), lat2=rad(b.lat);
    const hav = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(hav));
  }

  function permute(arr){
    if(arr.length<=1) return [arr];
    const result=[];
    arr.forEach((v,i)=>{
      const rest=[...arr.slice(0,i),...arr.slice(i+1)];
      permute(rest).forEach(p=>result.push([v,...p]));
    });
    return result;
  }

  optimizeBtn.onclick = async ()=>{
    resultsDiv.innerHTML='<span class="small">Working...</span>'; 
    linksDiv.innerHTML=''; 
    clearMap();
    optimizeBtn.disabled = true;
    try{
      const startRaw=$('start').value.trim(); 
      const endRaw=$('end').value.trim();
      const pickupInputs = Array.from(pickupsContainer.querySelectorAll('input')).map(i=>i.value.trim()).filter(v=>v);

      if(!endRaw) throw new Error('Enter final drop-off address (school)');
      if(pickupInputs.length===0) throw new Error('Enter at least one pickup');
      if(pickupInputs.length > 6) throw new Error('Maximum 6 pickups allowed!');

      // Get start point: Use GPS if blank
      let startPoint;
      if(!startRaw){
        if(!navigator.geolocation) throw new Error('No start location or GPS available.');
        resultsDiv.innerHTML='<span class="small">Getting your current location...</span>';
        startPoint = await new Promise((resolve,reject)=>{
          navigator.geolocation.getCurrentPosition(
            pos=>resolve({lat:pos.coords.latitude,lon:pos.coords.longitude,name:'Your location'}),
            err=>reject(new Error('Failed to get location: '+err.message))
          );
        });
      } else {
        startPoint = await geocode(startRaw);
      }
      let endPoint = await geocode(endRaw);

      // Geocode all pickups
      const pickups = [];
      for(const p of pickupInputs) pickups.push(await geocode(p));

      // Find best pickup order
      const orders=permute(pickups.map((_,i)=>i));
      let bestDist=Infinity, bestOrder=null;
      orders.forEach(order=>{
        let total=distance(startPoint,pickups[order[0]]);
        for(let i=0;i<order.length-1;i++) total+=distance(pickups[order[i]],pickups[order[i+1]]);
        total+=distance(pickups[order[order.length-1]],endPoint);
        if(total<bestDist){ bestDist=total; bestOrder=order; }
      });

      const route=[startPoint,...bestOrder.map(i=>pickups[i]),endPoint];
      // Show results
      resultsDiv.innerHTML='<ol>'+route.map((p,i)=>`<li>${i===0?'Start':i===route.length-1?'Drop-off':'Pickup'}: ${p.name}</li>`).join('')+'</ol>';
      resultsDiv.innerHTML+=`<div>Total straight-line distance ≈ <b>${(bestDist/1000).toFixed(2)} km</b></div>`;

      // Draw markers and route
      route.forEach((p,i)=>{
        let type = (i===0)?'start':(i===route.length-1?'dropoff':'pickup');
        addMarker(p.lat,p.lon,`${i===0?'Start':i===route.length-1?'Drop-off':'Pickup'}<br>${p.name}`,type);
      });
      routeLine=L.polyline(route.map(p=>[p.lat,p.lon]),{color:'blue',weight:5,opacity:0.7}).addTo(map);
      map.fitBounds(route.map(p=>[p.lat,p.lon]), {padding:[50,50]});

      // Google Maps link
      const origin=`${startPoint.lat},${startPoint.lon}`;
      const destination=`${endPoint.lat},${endPoint.lon}`;
      const waypoints=bestOrder.map(i=>`${pickups[i].lat},${pickups[i].lon}`).join('|');
      // Google Maps: up to 25 waypoints allowed, but we have max 6
      const gmaps=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving&waypoints=${encodeURIComponent(waypoints)}`;
      linksDiv.innerHTML=`<a class="link" href="${gmaps}" target="_blank">Open in Google Maps</a>`;

    }catch(err){ 
      resultsDiv.innerHTML='<span style="color:red">'+err.message+'</span>'; 
      console.error(err); 
    }
    optimizeBtn.disabled = false;
  }

  // Start with 3 pickups
  for(let i=0;i<3;i++) createPickup();
});
