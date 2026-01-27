/**
 * Weather Service
 * Fetches weather data from OpenWeatherMap API and creates alerts
 */

interface WeatherData {
  temp: number;
  feelsLike: number;
  condition: string;
  description: string;
  city: string;
}

interface WeatherAlert {
  alertType: string;
  temperatureCelsius: number;
  conditionText: string;
  message: string;
  suggestedAction: string;
}

export async function fetchWeatherData(
  cityName: string,
  countryCode: string,
  apiKey?: string
): Promise<WeatherData | null> {
  if (!apiKey) {
    console.warn("Weather API key not provided, skipping API call");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${cityName},${countryCode}&appid=${apiKey}&units=metric&lang=mn`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Weather API error:", response.status, response.statusText);
      console.error("Error details:", errorData);
      return null;
    }

    const data = await response.json();

    return {
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      condition: data.weather[0].main.toLowerCase(),
      description: data.weather[0].description,
      city: data.name,
    };
  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
}

export function checkWeatherAlerts(
  weatherData: WeatherData,
  coldThreshold: number = -25,
  heatThreshold: number = 35
): WeatherAlert | null {
  const { temp, feelsLike, condition, description } = weatherData;

  // Extreme cold check
  if (temp <= coldThreshold || feelsLike <= coldThreshold) {
    const tempToShow = Math.min(temp, feelsLike);
    return {
      alertType: "extreme_cold",
      temperatureCelsius: tempToShow,
      conditionText: description || "Хүйтэн",
      message: `Маргааш ${tempToShow}°C хүйтэн байна. Ажилтнууддаа гэрээсээ ажиллах санал тавих уу?`,
      suggestedAction: "work_from_home",
    };
  }

  // Extreme heat check
  if (temp >= heatThreshold || feelsLike >= heatThreshold) {
    const tempToShow = Math.max(temp, feelsLike);
    return {
      alertType: "extreme_heat",
      temperatureCelsius: tempToShow,
      conditionText: description || "Халуун",
      message: `Маргааш ${tempToShow}°C халуун байна. Ажилтнууддаа анхааруулга өгөх уу?`,
      suggestedAction: "avoid_outdoor",
    };
  }

  // Air pollution check (if condition indicates)
  if (condition.includes("smoke") || condition.includes("haze") || description?.includes("утаа")) {
    return {
      alertType: "air_pollution",
      temperatureCelsius: temp,
      conditionText: description || "Утаа",
      message: "Агаарын бохирдол өндөр байна. Гадны ажил хийхээс зайлсхийх санал тавих уу?",
      suggestedAction: "avoid_outdoor",
    };
  }

  return null;
}
