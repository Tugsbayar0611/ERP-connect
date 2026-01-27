
import { fetchWeatherData } from "../server/weather-service";

const VALID_KEY = "f7e465be732877cf8638f9b60c5bcc86";

async function test() {
    console.log("Testing RESTORED OpenWeatherMap Service with valid key...");
    try {
        const result = await fetchWeatherData("Ulaanbaatar", "MN", VALID_KEY);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
}

test();
