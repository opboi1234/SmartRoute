# SmartRoute

SmartRoute is a simple web app that helps drivers plan the best pickup and drop-off route for students. Enter your start point, add up to six pickup stops, and a final school destination. The app calculates the most efficient order, shows the route on a map (using real roads!), and lets you open it in Google Maps for turn-by-turn navigation.

## Features

- **Simple UI:** Enter addresses or coordinates, and click optimize.
- **Supports GPS:** Use your device location for the start.
- **Efficient Order:** Finds the best pickup sequence using a brute-force TSP approach (up to 6 pickups).
- **Interactive Map:** Visualizes route with road-following lines via OpenRouteService.
- **Google Maps Link:** One-click to open the route for turn-by-turn directions.
- **Responsive:** Works on desktop and mobile.

## How to Use

1. Open `index.html` in your browser.
2. Enter a start location (address or `lat,lon`), or use your device location.
3. Add pickup addresses (up to 6).
4. Enter the school drop-off location.
5. Click **Get best route**.
6. See the best order, route map, and a Google Maps link.

## Development

- All code is in three files: `index.html`, `SmartRoute.js`, `SmartRoute.css`.
- Uses [Leaflet](https://leafletjs.com/) for maps, [OpenRouteService](https://openrouteservice.org/) for routing, and [OpenStreetMap Nominatim](https://nominatim.org/) for geocoding.
- No server required; logic is client-side.

## Customization

- Modify `SmartRoute.css` for branding.
- Change marker icons in `SmartRoute.js` for your theme.

## Tips

- For more than 6 pickups, performance drops (factorial complexity).
- Enter either street addresses or latitude,longitude.
- If map fails to load, check your internet or refresh.
- If OpenRouteService fails, you'll see a straight line and an error message.

## License

MIT License
