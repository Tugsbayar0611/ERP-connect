/**
 * Test Weather API
 * Tests weather service with API key
 */

import { fetchWeatherData, checkWeatherAlerts } from "../server/weather-service";
import "dotenv/config";

async function testWeather() {
  console.log("🌤️  Testing Weather API...\n");

  const apiKey = process.env.WEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY;
  
  if (!apiKey) {
    console.error("❌ API key not found!");
    console.log("Please add to .env file:");
    console.log("WEATHER_API_KEY=your_key_here");
    console.log("\nOr:");
    console.log("OPENWEATHERMAP_API_KEY=your_key_here");
    process.exit(1);
  }

  console.log("✅ API Key found:", apiKey.substring(0, 10) + "...");
  console.log("📍 Fetching weather for Ulaanbaatar, MN...\n");

  try {
    const weatherData = await fetchWeatherData("Ulaanbaatar", "MN", apiKey);
    
    if (!weatherData) {
      console.error("❌ Failed to fetch weather data");
      process.exit(1);
    }

    console.log("✅ Weather data received:");
    console.log("  Temperature:", weatherData.temp + "°C");
    console.log("  Feels like:", weatherData.feelsLike + "°C");
    console.log("  Condition:", weatherData.condition);
    console.log("  Description:", weatherData.description);
    console.log("  City:", weatherData.city);
    console.log("");

    // Check for alerts
    const alert = checkWeatherAlerts(weatherData, -25, 35);
    
    if (alert) {
      console.log("⚠️  ALERT DETECTED:");
      console.log("  Type:", alert.alertType);
      console.log("  Message:", alert.message);
      console.log("  Suggested Action:", alert.suggestedAction);
    } else {
      console.log("✅ No alerts - weather is normal");
    }

    console.log("\n✅ Weather API test completed successfully!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("401") || error.message.includes("Invalid API key")) {
      console.error("\n⚠️  API key is invalid. Please check your key at:");
      console.error("   https://home.openweathermap.org/api_keys");
    }
    process.exit(1);
  }
}

testWeather();
