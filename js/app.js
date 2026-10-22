const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const locationButton = document.querySelector("#location-button");
const statusMessage = document.querySelector("#status-message");
const citySuggestions = document.querySelector("#city-suggestions");
const locationChoices = document.querySelector("#location-choices");
const locationChoiceList = document.querySelector("#location-choice-list");
const watchlistEmpty = document.querySelector("#watchlist-empty");
const watchlistGrid = document.querySelector("#watchlist-grid");
const weatherResults = document.querySelector("#weather-results");
const locationName = document.querySelector("#location-name");
const currentCondition = document.querySelector("#current-condition");
const currentIcon = document.querySelector("#current-icon");
const currentTemperature = document.querySelector("#current-temperature");
const humidityValue = document.querySelector("#humidity-value");
const windValue = document.querySelector("#wind-value");
const forecastGrid = document.querySelector("#forecast-grid");
const temperatureUnit = document.querySelector("#temperature-unit");
const celsiusButton = document.querySelector("#celsius-button");
const fahrenheitButton = document.querySelector("#fahrenheit-button");
const saveCityButton = document.querySelector("#save-city-button");
const lastCityStorageKey = "weather-app-last-city";
const savedCitiesStorageKey = "weather-app-saved-cities";

let currentLocation = null;
let currentWeather = null;
let savedCities = [];
const savedWeather = new Map();
let selectedUnit = "C";
let activeSearchId = 0;
let suggestionRequestId = 0;
let suggestionTimer = null;
let suggestionController = null;

searchForm.addEventListener("submit", handleSearch);
cityInput.addEventListener("input", handleCityInput);
locationButton.addEventListener("click", handleUseMyLocation);
celsiusButton.addEventListener("click", () => setTemperatureUnit("C"));
fahrenheitButton.addEventListener("click", () => setTemperatureUnit("F"));
saveCityButton.addEventListener("click", saveCurrentCity);
loadSavedCities();
loadLastCity();

function loadSavedCities() {
  try {
    const storedCities = localStorage.getItem(savedCitiesStorageKey);
    if (!storedCities) {
      renderWatchlist();
      return;
    }

    const parsedCities = JSON.parse(storedCities);
    if (!Array.isArray(parsedCities)) {
      throw new Error("Saved cities data is not a list.");
    }

    savedCities = parsedCities.filter(
      (city) =>
        typeof city.name === "string" &&
        typeof city.country === "string" &&
        Number.isFinite(city.latitude) &&
        city.latitude >= -90 &&
        city.latitude <= 90 &&
        Number.isFinite(city.longitude) &&
        city.longitude >= -180 &&
        city.longitude <= 180 &&
        (city.admin1 === undefined || typeof city.admin1 === "string"),
    );
    savedCities = removeDuplicateLocations(savedCities);
    renderWatchlist();
    refreshSavedCityWeather();
  } catch (error) {
    showError("Saved cities couldn't be loaded. You can still search and save cities.");
  }
}

async function refreshSavedCityWeather() {
  const locationsToRefresh = [...savedCities];

  await Promise.all(
    locationsToRefresh.map(async (location) => {
      const key = getLocationKey(location);
      try {
        const weather = await getWeather(location);
        if (savedCities.some((city) => getLocationKey(city) === key)) {
          savedWeather.set(key, { weather, error: "" });
          renderWatchlist();
        }
      } catch (error) {
        if (savedCities.some((city) => getLocationKey(city) === key)) {
          savedWeather.set(key, {
            weather: null,
            error: "Weather is unavailable right now.",
          });
          renderWatchlist();
        }
      }
    }),
  );
}

function renderWatchlist() {
  watchlistGrid.replaceChildren();
  watchlistEmpty.hidden = savedCities.length > 0;

  savedCities.forEach((location) => {
    const key = getLocationKey(location);
    const saved = savedWeather.get(key);
    const card = document.createElement("article");
    const details = document.createElement("div");
    const name = document.createElement("h3");
    const conditionText = document.createElement("p");
    const temperature = document.createElement("p");
    const actions = document.createElement("div");
    const forecastButton = document.createElement("button");
    const removeButton = document.createElement("button");
    const region = location.admin1 ? `, ${location.admin1}` : "";

    card.className = "watchlist-card";
    name.textContent = `${location.name}${region}, ${location.country}`;
    conditionText.className = "watchlist-condition";
    temperature.className = "watchlist-temperature";

    if (saved?.weather) {
      const current = saved.weather.current;
      const condition = getWeatherCondition(current.weather_code);
      conditionText.textContent = `${condition.emoji} ${condition.description}`;
      temperature.textContent =
        `${convertTemperature(current.temperature_2m)}°${selectedUnit}`;
    } else if (saved?.error) {
      conditionText.textContent = saved.error;
      temperature.textContent = "—";
    } else {
      conditionText.textContent = "Loading current weather...";
      temperature.textContent = "…";
    }

    actions.className = "watchlist-actions";
    forecastButton.type = "button";
    forecastButton.textContent = "View 5-day forecast";
    forecastButton.addEventListener("click", () => {
      cityInput.value = location.name;
      selectLocation(location, location.name);
    });
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeSavedCity(location));
    actions.append(forecastButton, removeButton);
    details.append(name, conditionText);
    card.append(details, temperature, actions);
    watchlistGrid.append(card);
  });

  updateSaveCityButton();
}

function saveCurrentCity() {
  if (!currentLocation || !currentWeather) {
    return;
  }

  const key = getLocationKey(currentLocation);
  if (savedCities.some((city) => getLocationKey(city) === key)) {
    return;
  }

  savedCities.push({ ...currentLocation });
  savedWeather.set(key, { weather: currentWeather, error: "" });
  persistSavedCities();
  renderWatchlist();
}

function removeSavedCity(location) {
  const key = getLocationKey(location);
  savedCities = savedCities.filter((city) => getLocationKey(city) !== key);
  savedWeather.delete(key);
  persistSavedCities();
  renderWatchlist();
}

function persistSavedCities() {
  try {
    localStorage.setItem(savedCitiesStorageKey, JSON.stringify(savedCities));
  } catch (error) {
    showError("The watchlist changed, but this browser couldn't save it.");
  }
}

function updateSaveCityButton() {
  const isSaved =
    currentLocation &&
    savedCities.some(
      (city) => getLocationKey(city) === getLocationKey(currentLocation),
    );
  saveCityButton.disabled = !currentLocation || Boolean(isSaved);
  saveCityButton.textContent = isSaved ? "Saved to watchlist" : "Save city";
}

function getLocationKey(location) {
  return [
    location.latitude.toFixed(5),
    location.longitude.toFixed(5),
    normalizeLocationPart(location.country),
  ].join("|");
}

async function handleSearch(event) {
  event.preventDefault();
  cancelCitySuggestions();
  locationButton.disabled = false;
  locationButton.textContent = "Use my location";
  const searchId = ++activeSearchId;

  const cityName = cityInput.value.trim();

  if (!cityName) {
    cityInput.setAttribute("aria-invalid", "true");
    currentLocation = null;
    currentWeather = null;
    weatherResults.hidden = true;
    weatherResults.setAttribute("aria-busy", "false");
    locationChoices.hidden = true;
    updateSaveCityButton();
    searchButton.disabled = false;
    showError("Please enter a city name.");
    return;
  }

  cityInput.removeAttribute("aria-invalid");
  statusMessage.textContent = "Loading weather...";
  statusMessage.classList.remove("is-error");
  searchButton.disabled = true;
  weatherResults.hidden = true;
  weatherResults.setAttribute("aria-busy", "true");
  locationChoices.hidden = true;
  locationChoiceList.replaceChildren();
  currentLocation = null;
  currentWeather = null;
  updateSaveCityButton();

  try {
    const locations = await getCoordinates(cityName, 100);
    if (searchId !== activeSearchId) {
      return;
    }

    if (locations.length === 0) {
      throw new Error("We couldn't find that place. Try another spelling or nearby larger town.");
    }

    if (locations.length > 1) {
      renderLocationChoices(locations, searchId);
      statusMessage.textContent = "More than one place matched. Choose a location.";
    } else {
      await loadWeatherForLocation(locations[0], cityName, searchId);
    }
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    const message =
      error instanceof TypeError || error instanceof SyntaxError
        ? "We couldn't search for that place right now. Check your connection and try again."
        : error.message;
    showError(message);
  } finally {
    if (searchId === activeSearchId) {
      weatherResults.setAttribute("aria-busy", "false");
      searchButton.disabled = false;
      locationButton.disabled = false;
    }
  }
}

async function handleUseMyLocation() {
  cancelCitySuggestions();
  const searchId = ++activeSearchId;

  if (!window.isSecureContext) {
    showError("Location access needs a secure page. Open this app over HTTPS or localhost.");
    return;
  }

  if (!navigator.geolocation) {
    showError("Location services aren't available in this browser. Search for a city instead.");
    return;
  }

  statusMessage.textContent = "Asking your device for your location...";
  statusMessage.classList.remove("is-error");
  searchButton.disabled = true;
  locationButton.disabled = true;
  locationButton.textContent = "Finding your location...";
  weatherResults.hidden = true;
  weatherResults.setAttribute("aria-busy", "true");
  locationChoices.hidden = true;
  currentLocation = null;
  currentWeather = null;
  updateSaveCityButton();

  try {
    const position = await getCurrentPosition();
    if (searchId !== activeSearchId) {
      return;
    }

    const { latitude, longitude } = position.coords;
    const location = {
      name: "Your location",
      country: "",
      admin1: "",
      latitude,
      longitude,
    };

    let placeNameAvailable = true;
    try {
      const place = await getPlaceName(latitude, longitude);
      location.name = place.name;
      location.country = place.country;
      location.admin1 = place.admin1;
    } catch (error) {
      placeNameAvailable = false;
    }

    if (searchId !== activeSearchId) {
      return;
    }

    await loadWeatherForLocation(location, "", searchId);
    if (!placeNameAvailable && searchId === activeSearchId) {
      statusMessage.textContent =
        "Weather loaded, but we couldn't identify the nearby city.";
    }
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    if (typeof error.code === "number") {
      if (error.code === 1) {
        showError("Location access was denied. Allow it in your browser settings or search for a city.");
      } else if (error.code === 3) {
        showError("Finding your location took too long. Try again or search for a city.");
      } else {
        showError("Your location couldn't be determined. Check device location services or search for a city.");
      }
    } else {
      const message =
        error instanceof TypeError || error instanceof SyntaxError
          ? "We couldn't load weather for your location. Check your connection and try again."
          : error.message;
      showError(message);
    }
  } finally {
    if (searchId === activeSearchId) {
      weatherResults.setAttribute("aria-busy", "false");
      searchButton.disabled = false;
      locationButton.disabled = false;
      locationButton.textContent = "Use my location";
    }
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

async function getPlaceName(latitude, longitude) {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "en",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error("The place-name service is unavailable.");
  }

  const place = await response.json();
  const administrativePlaces = place.localityInfo?.administrative;
  const name =
    place.city ||
    place.locality ||
    administrativePlaces?.[administrativePlaces.length - 1]?.name;
  if (typeof name !== "string" || typeof place.countryName !== "string") {
    throw new Error("The place-name service returned incomplete data.");
  }

  return {
    name,
    country: place.countryName,
    admin1: typeof place.principalSubdivision === "string"
      ? place.principalSubdivision
      : "",
  };
}

function handleCityInput() {
  activeSearchId += 1;
  searchButton.disabled = false;
  locationButton.disabled = false;
  locationButton.textContent = "Use my location";
  weatherResults.setAttribute("aria-busy", "false");
  weatherResults.hidden = true;
  locationChoices.hidden = true;
  locationChoiceList.replaceChildren();
  statusMessage.textContent = "";
  statusMessage.classList.remove("is-error");
  cityInput.removeAttribute("aria-invalid");
  currentLocation = null;
  currentWeather = null;
  updateSaveCityButton();
  cancelCitySuggestions();

  const cityName = cityInput.value.trim();
  if (cityName.length < 2) {
    return;
  }

  const requestId = suggestionRequestId;
  suggestionTimer = setTimeout(() => {
    loadCitySuggestions(cityName, requestId);
  }, 300);
}

async function loadCitySuggestions(cityName, requestId) {
  const controller = new AbortController();
  suggestionController = controller;

  try {
    const locations = await getCoordinates(cityName, 10, controller.signal);
    if (requestId !== suggestionRequestId) {
      return;
    }

    renderCitySuggestions(locations);
    if (locations.length === 0) {
      statusMessage.textContent = "No matching places yet. Try another spelling.";
    }
  } catch (error) {
    if (error.name === "AbortError" || requestId !== suggestionRequestId) {
      return;
    }

    showError(
      error instanceof TypeError
        ? "City suggestions are unavailable right now. You can still press Search."
        : error.message,
    );
  } finally {
    if (suggestionController === controller) {
      suggestionController = null;
    }
  }
}

function renderCitySuggestions(locations) {
  citySuggestions.replaceChildren();

  locations.slice(0, 8).forEach((location) => {
    const button = document.createElement("button");
    const region = location.admin1 ? `, ${location.admin1}` : "";
    button.type = "button";
    button.className = "city-suggestion";
    button.textContent = `${location.name}${region}, ${location.country}`;
    button.addEventListener("click", () => {
      cityInput.value = location.name;
      clearCitySuggestions();
      selectLocation(location, location.name);
    });
    citySuggestions.append(button);
  });

  const hasSuggestions = citySuggestions.childElementCount > 0;
  citySuggestions.hidden = !hasSuggestions;
  cityInput.setAttribute("aria-expanded", String(hasSuggestions));
}

function clearCitySuggestions() {
  citySuggestions.replaceChildren();
  citySuggestions.hidden = true;
  cityInput.setAttribute("aria-expanded", "false");
}

function cancelCitySuggestions() {
  clearTimeout(suggestionTimer);
  suggestionTimer = null;
  suggestionRequestId += 1;
  if (suggestionController) {
    suggestionController.abort();
    suggestionController = null;
  }
  clearCitySuggestions();
}

async function selectLocation(location, searchedName) {
  const searchId = ++activeSearchId;
  cancelCitySuggestions();
  statusMessage.textContent = "Loading weather...";
  statusMessage.classList.remove("is-error");
  searchButton.disabled = true;
  weatherResults.hidden = true;
  weatherResults.setAttribute("aria-busy", "true");
  locationChoices.hidden = true;

  try {
    await loadWeatherForLocation(location, searchedName, searchId);
  } catch (error) {
    if (searchId !== activeSearchId) {
      return;
    }

    const message =
      error instanceof TypeError || error instanceof SyntaxError
        ? "We couldn't load weather right now. Check your connection and try again."
        : error.message;
    showError(message);
  } finally {
    if (searchId === activeSearchId) {
      weatherResults.setAttribute("aria-busy", "false");
      searchButton.disabled = false;
    }
  }
}

async function loadWeatherForLocation(location, searchedName, searchId) {
  const weather = await getWeather(location);
  if (searchId !== activeSearchId) {
    return;
  }

  currentLocation = location;
  currentWeather = weather;
  renderCurrent(currentWeather);
  weatherResults.hidden = false;
  locationChoices.hidden = true;
  statusMessage.textContent = "";
  statusMessage.classList.remove("is-error");

  try {
    if (searchedName) {
      localStorage.setItem(lastCityStorageKey, searchedName);
    }
  } catch (error) {
    statusMessage.textContent =
      "Weather loaded, but this browser couldn't save your last city.";
  }
}

function renderLocationChoices(locations, searchId) {
  locationChoiceList.replaceChildren();

  locations.slice(0, 10).forEach((location) => {
    const button = document.createElement("button");
    const region = location.admin1 ? `, ${location.admin1}` : "";
    button.type = "button";
    button.className = "location-choice";
    button.textContent = `${location.name}${region}, ${location.country}`;
    button.addEventListener("click", async () => {
      if (searchId !== activeSearchId) {
        return;
      }

      cityInput.value = location.name;
      locationChoiceList
        .querySelectorAll("button")
        .forEach((choice) => {
          choice.disabled = true;
        });
      selectLocation(location, location.name);
    });
    locationChoiceList.append(button);
  });

  locationChoices.hidden = false;
}

function loadLastCity() {
  try {
    const lastCity = localStorage.getItem(lastCityStorageKey);
    if (lastCity) {
      cityInput.value = lastCity;
      searchForm.requestSubmit();
    }
  } catch (error) {
    showError("This browser couldn't access saved city data.");
  }
}

async function getCoordinates(cityName, count = 10, signal) {
  const query = new URLSearchParams({
    name: cityName,
    count: String(count),
    language: "en",
    format: "json",
  });
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${query}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error("The city search service is unavailable. Please try again.");
  }

  const data = await response.json();
  const locations = data.results ?? [];

  if (!Array.isArray(locations)) {
    throw new Error("The location service returned an unexpected response. Please try again.");
  }

  const validLocations = locations
    .filter(
      (place) =>
        typeof place.name === "string" &&
        typeof place.country === "string" &&
        typeof place.latitude === "number" &&
        typeof place.longitude === "number",
    )
    .map((place) => ({
      name: place.name,
      country: place.country,
      admin1: place.admin1,
      latitude: place.latitude,
      longitude: place.longitude,
    }));

  return removeDuplicateLocations(validLocations).slice(0, 20);
}

function removeDuplicateLocations(locations) {
  const seenNames = new Set();
  const seenCoordinates = new Set();

  return locations.filter((location) => {
    const nameKey = [
      location.name,
      location.admin1 || "",
      location.country,
    ]
      .map(normalizeLocationPart)
      .join("|");
    const coordinateKey = [
      location.latitude.toFixed(3),
      location.longitude.toFixed(3),
      normalizeLocationPart(location.country),
    ].join("|");

    if (seenNames.has(nameKey) || seenCoordinates.has(coordinateKey)) {
      return false;
    }

    seenNames.add(nameKey);
    seenCoordinates.add(coordinateKey);
    return true;
  });
}

function normalizeLocationPart(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function getWeather(location) {
  const query = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    timezone: "auto",
    forecast_days: "5",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${query}`,
  );

  if (!response.ok) {
    throw new Error("The weather service is unavailable. Please try again.");
  }

  const data = await response.json();
  const current = data.current;
  const daily = data.daily;
  const forecastFields = [
    daily?.time,
    daily?.weather_code,
    daily?.temperature_2m_max,
    daily?.temperature_2m_min,
  ];

  if (
    !current ||
    !Number.isFinite(current.temperature_2m) ||
    !Number.isFinite(current.relative_humidity_2m) ||
    current.relative_humidity_2m < 0 ||
    current.relative_humidity_2m > 100 ||
    !Number.isFinite(current.wind_speed_10m) ||
    current.wind_speed_10m < 0 ||
    !Number.isInteger(current.weather_code) ||
    !data.current_units ||
    data.current_units.temperature_2m !== "°C" ||
    data.current_units.relative_humidity_2m !== "%" ||
    data.current_units.wind_speed_10m !== "km/h" ||
    !data.daily_units ||
    data.daily_units.temperature_2m_max !== "°C" ||
    data.daily_units.temperature_2m_min !== "°C" ||
    forecastFields.some(
      (field) => !Array.isArray(field) || field.length < 5,
    ) ||
    daily.time.slice(0, 5).some(
      (date) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date),
    ) ||
    daily.weather_code.slice(0, 5).some((code) => !Number.isInteger(code)) ||
    daily.temperature_2m_max
      .slice(0, 5)
      .some((temperature) => !Number.isFinite(temperature)) ||
    daily.temperature_2m_min
      .slice(0, 5)
      .some((temperature) => !Number.isFinite(temperature)) ||
    daily.temperature_2m_max
      .slice(0, 5)
      .some((temperature, index) => temperature < daily.temperature_2m_min[index])
  ) {
    throw new Error("The weather service returned incomplete data. Please try again.");
  }

  return data;
}

function renderCurrent(weather) {
  const current = weather.current;
  const condition = getWeatherCondition(current.weather_code);
  const region = currentLocation.admin1 ? `, ${currentLocation.admin1}` : "";
  locationName.textContent = formatLocationName(currentLocation);
  currentCondition.textContent = condition.description;
  currentIcon.textContent = condition.emoji;
  currentTemperature.textContent = convertTemperature(current.temperature_2m);
  temperatureUnit.textContent = `°${selectedUnit}`;
  humidityValue.textContent =
    `${current.relative_humidity_2m} ${weather.current_units.relative_humidity_2m}`;
  windValue.textContent =
    `${current.wind_speed_10m} ${weather.current_units.wind_speed_10m}`;
  celsiusButton.setAttribute("aria-pressed", String(selectedUnit === "C"));
  fahrenheitButton.setAttribute("aria-pressed", String(selectedUnit === "F"));
  renderForecast(weather.daily);
  updateSaveCityButton();
}

function setTemperatureUnit(unit) {
  selectedUnit = unit;
  if (currentWeather) {
    renderCurrent(currentWeather);
  }
  renderWatchlist();
}

function convertTemperature(celsius) {
  const temperature =
    selectedUnit === "F" ? (celsius * 9) / 5 + 32 : celsius;
  return temperature.toFixed(1);
}

function formatLocationName(location) {
  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");
}

function getWeatherCondition(code) {
  if (code === 0) {
    return { description: "Clear sky", emoji: "☀️" };
  }
  if (code <= 3 && code >= 1) {
    return { description: "Partly cloudy", emoji: "⛅" };
  }
  if (code === 45 || code === 48) {
    return { description: "Fog", emoji: "🌫️" };
  }
  if (code >= 51 && code <= 57) {
    return { description: "Drizzle", emoji: "🌦️" };
  }
  if (code >= 61 && code <= 67) {
    return { description: "Rain", emoji: "🌧️" };
  }
  if (code >= 71 && code <= 77) {
    return { description: "Snow", emoji: "❄️" };
  }
  if (code === 85 || code === 86) {
    return { description: "Snow showers", emoji: "🌨️" };
  }
  if (code >= 80 && code <= 82) {
    return { description: "Rain showers", emoji: "🌧️" };
  }
  if (code >= 95 && code <= 99) {
    return { description: "Thunderstorm", emoji: "⛈️" };
  }
  return { description: "Unknown conditions", emoji: "🌡️" };
}

function renderForecast(daily) {
  forecastGrid.replaceChildren();

  daily.time.slice(0, 5).forEach((date, index) => {
    const condition = getWeatherCondition(daily.weather_code[index]);
    const card = document.createElement("article");
    const day = document.createElement("h3");
    const icon = document.createElement("p");
    const temperatures = document.createElement("p");

    card.className = "forecast-card";
    day.textContent = formatDay(date);
    icon.className = "forecast-icon";
    icon.textContent = condition.emoji;
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", condition.description);
    temperatures.className = "forecast-temperatures";
    temperatures.textContent =
      `${convertTemperature(daily.temperature_2m_max[index])}°${selectedUnit} / ` +
      `${convertTemperature(daily.temperature_2m_min[index])}°${selectedUnit}`;

    card.append(day, icon, temperatures);
    forecastGrid.append(card);
  });
}

function formatDay(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add("is-error");
}
