
import { fetchWeatherData } from "../server/weather-service";

async function test() {
    console.log("Testing fetchWeatherData...");
    try {
        const result = await fetchWeatherData("Ulaanbaatar", "MN");
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
