# SmartRoute

**SmartRoute** is a user-friendly web application designed to help drivers efficiently plan pickup and drop-off routes for students. Simply enter your starting point, add up to six pickup stops, and specify the final school destination. The app calculates the optimal route, saving you time and fuel.

---

### Features

- **Intuitive Interface:** Quickly enter addresses or coordinates and optimize your route with a single click.
- **GPS Integration:** Start from your current device location for convenience.
- **Optimal Routing:** Uses a brute-force Traveling Salesman Problem (TSP) solution to find the best pickup sequence (supports up to 6 stops for speed).
- **Live Interactive Map:** Visualizes your route with accurate, road-following lines powered by OpenRouteService.
- **Direct Navigation:** Instantly open the optimized route in Google Maps for turn-by-turn directions.
- **Mobile-Friendly:** Responsive design works seamlessly on both desktop and mobile devices.

---

### Getting Started

1. Open `index.html` in your browser.
2. Enter your starting location (address or `latitude,longitude`), or use your device's current location.
3. Add pickup addresses (maximum of 6).
4. Enter the school drop-off location.
5. Click **Get Best Route**.
6. Review the optimized order, interactive route map, and direct Google Maps link.

---

### How It Works

- All logic is implemented client-side, with no server required.
- The app uses:
  - [Leaflet](https://leafletjs.com/) for interactive mapping.
  - [OpenRouteService](https://openrouteservice.org/) for route optimization.
  - [OpenStreetMap Nominatim](https://nominatim.org/) for address geocoding.

---

### Customization

- Update `SmartRoute.css` to modify styles and branding.
- Change marker icons in `SmartRoute.js` to match your theme.

---

### Important Notes & Tips

- Performance drops for more than 6 pickups (due to factorial complexity).
- You can enter either street addresses or precise latitude,longitude coordinates.
- If the map fails to load, please check your internet connection or refresh the page.
- If OpenRouteService is unavailable, the app will display a straight line and an error message.

---

### License

This project is licensed under the MIT License.
