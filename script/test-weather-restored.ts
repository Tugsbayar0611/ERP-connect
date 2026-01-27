
import dotenv from "dotenv";
import path from "path";
import { fetchWeatherData } from "../server/weather-service";

// Load .env explicitly
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function test() {
    console.log("Testing RESTORED OpenWeatherMap Service...");
    const apiKey = process.env.WEATHER_API_KEY;
    console.log("API Key present:", !!apiKey);

    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }

    try {
        const result = await fetchWeatherData("Ulaanbaatar", "MN", apiKey);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
