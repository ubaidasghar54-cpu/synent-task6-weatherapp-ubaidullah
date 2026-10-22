# Weather

A small, responsive weather dashboard built for Task 6 of the Synent
Technologies Web Development Internship. Search for a place, check its
conditions, and save the cities you want to keep an eye on.

## Features

- Search by city name, with search submission by button or Enter.
- Get live city suggestions after typing two characters, including region and
  country when available.
- Use the browser's location permission to look up weather near the device.
- Choose between matching locations using region and country names.
- Save and remove cities in a persistent watchlist. Saved cities show current
  conditions and link to their five-day forecast.
- Display the current temperature, weather condition, humidity, and wind speed.
- View a five-day forecast with weather icons and daily high and low temperatures.
- Switch between Celsius and Fahrenheit without making another API request.
- Remember the last searched city with `localStorage`.
- Show loading feedback and friendly messages for empty input, unknown places,
  and request failures.
- Responsive layout with keyboard focus styles and screen-reader announcements.

## Technologies

- HTML
- CSS
- Vanilla JavaScript using the Fetch API and `async`/`await`
- Open-Meteo Geocoding API and Forecast API

No API key, framework, library, or build tool is required.

## Weather data

The app uses Open-Meteo's [Geocoding API](https://geocoding-api.open-meteo.com/v1/search)
to find a place, then its [Forecast API](https://api.open-meteo.com/v1/forecast)
to fetch current conditions and five forecast days for the selected coordinates.
The optional current-location feature uses the browser Geolocation API and
[BigDataCloud](https://www.bigdatacloud.com/) to turn coordinates into a nearby
place name.

No API key is needed. The app requests Celsius and kilometre-per-hour wind data;
Fahrenheit conversion happens in the browser. Suggestions come from Open-Meteo's
geocoding database, so a small settlement may be listed under an alternate name.

Location access is requested only after selecting **Use my location**. The
browser requires a secure context (usually HTTPS or localhost) and the user's
permission. Depending on the device, location may come from GPS, Wi-Fi, or
network positioning; desktop computers are not guaranteed to have GPS.
Coordinates are sent to Open-Meteo for the forecast and BigDataCloud for the
nearby place name. City search remains available if location is unsupported or
permission is denied.

## Run locally

1. Clone or download this repository.
2. Open `index.html` in a modern browser.
3. Search for a place, such as Murree, Keswick, or Helsinki.

An internet connection is needed for weather data and the Google Font. If your
browser restricts local file requests, open the folder through a simple static
web server. There is no build step.

## Screenshots

_Add a screenshot of the app here._

## Live demo

_Add the deployed app URL here._
