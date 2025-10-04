// Wait for both DOM and Leaflet to be ready
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

  // Initialize map safely - check if Leaflet is available
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    resultsDiv.innerHTML = '<span style="color:red">Error: Map library failed to load. Please refresh the page.</span>';
    return;
  }

  let map;
  try {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Map element not found');
      return;
    }
    map = L.map('map').setView([43.32, -79.80], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  } catch(e) {
    console.error('Map initialization error:', e);
    resultsDiv.innerHTML = '<span style="color:red">Error initializing map: ' + e.message + '</span>';
    return;
  }

  let markers = [];
  let routeLine = null;

  function addMarker(lat, lon, label){
    const m = L.marker([lat, lon]).addTo(map).bindPopup(label);
    markers.push(m);
  }

  function clearMap(){
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if(routeLine) map.removeLayer(routeLine);
  }

  function createPickup(value=''){
    pickupCount++;
    const div = document.createElement('div');
    div.className='waypoint';
    const input = document.createElement('input');
    input.type='text';
    input.placeholder='Pickup address';
    input.value = value;
    const btn = document.createElement('button');
    btn.textContent='✖';
    btn.onclick=()=>div.remove();
    div.appendChild(input);
    div.appendChild(btn);
    pickupsContainer.appendChild(div);
  }

  addPickupBtn.onclick = ()=>createPickup();

  clearBtn.onclick = ()=>{
    $('start').value=''; 
    $('end').value=''; 
    pickupsContainer.innerHTML=''; 
    pickupCount=0;
    createPickup(); createPickup(); createPickup();
    resultsDiv.innerHTML=''; 
    linksDiv.innerHTML=''; 
    clearMap();
  };

  useLocationBtn.onclick = ()=>{
    if(!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(pos=>{
      $('start').value=`${pos.coords.latitude},${pos.coords.longitude}`;
      map.setView([pos.coords.latitude,pos.coords.longitude],12);
      addMarker(pos.coords.latitude,pos.coords.longitude,'Your location');
    });
  };

  async function geocode(address){
    const url=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
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
    resultsDiv.innerHTML='Working...'; 
    linksDiv.innerHTML=''; 
    clearMap();
    try{
      const startRaw=$('start').value.trim(); 
      const endRaw=$('end').value.trim();
      const pickupInputs = Array.from(pickupsContainer.querySelectorAll('input')).map(i=>i.value.trim()).filter(v=>v);
      if(!endRaw) throw new Error('Enter final drop-off address');
      if(pickupInputs.length===0) throw new Error('Enter at least one pickup');

      let startPoint = /^\d/.test(startRaw) ? {lat:parseFloat(startRaw.split(',')[0]), lon:parseFloat(startRaw.split(',')[1]), name:'Start'} : await geocode(startRaw);
      let endPoint = /^\d/.test(endRaw) ? {lat:parseFloat(endRaw.split(',')[0]), lon:parseFloat(endRaw.split(',')[1]), name:'End'} : await geocode(endRaw);

      const pickups = [];
      for(const p of pickupInputs) pickups.push(await geocode(p));

      const orders=permute(pickups.map((p,i)=>i));
      let bestDist=Infinity, bestOrder=null;

      orders.forEach(order=>{
        let total=distance(startPoint,pickups[order[0]]);
        for(let i=0;i<order.length-1;i++) total+=distance(pickups[order[i]],pickups[order[i+1]]);
        total+=distance(pickups[order[order.length-1]],endPoint);
        if(total<bestDist){ bestDist=total; bestOrder=order; }
      });

      const route=[startPoint,...bestOrder.map(i=>pickups[i]),endPoint];
      resultsDiv.innerHTML='<ol>'+route.map((p,i)=>`<li>${i===0?'Start':i===route.length-1?'Drop-off':'Pickup'}: ${p.name}</li>`).join('')+'</ol>';
      resultsDiv.innerHTML+=`<div>Total straight-line distance ≈ ${(bestDist/1000).toFixed(2)} km</div>`;

      route.forEach((p,i)=>addMarker(p.lat,p.lon,`${i===0?'Start':i===route.length-1?'Drop-off':'Pickup'}\n${p.name}`));
      routeLine=L.polyline(route.map(p=>[p.lat,p.lon]),{color:'blue'}).addTo(map);
      map.fitBounds(route.map(p=>[p.lat,p.lon]), {padding:[50,50]});

      const origin=`${startPoint.lat},${startPoint.lon}`;
      const destination=`${endPoint.lat},${endPoint.lon}`;
      const waypoints=bestOrder.map(i=>`${pickups[i].lat},${pickups[i].lon}`).join('|');
      const gmaps=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving&waypoints=${encodeURIComponent(waypoints)}`;
      linksDiv.innerHTML=`<a class="link" href="${gmaps}" target="_blank">Open in Google Maps</a>`;

    }catch(err){ 
      resultsDiv.innerHTML='<span style="color:red">'+err.message+'</span>'; 
      console.error(err); 
    }
  }

  // Start with 3 pickups
  createPickup(); createPickup(); createPickup();
});
