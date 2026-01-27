
const apiKey = "f7e465be732877cf8638f9b60c5bcc86";
const url = `https://api.openweathermap.org/data/2.5/weather?q=Ulaanbaatar,MN&appid=${apiKey}&units=metric`;

async function verify() {
    console.log("Verifying API Key...");
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Status:", res.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

verify();
