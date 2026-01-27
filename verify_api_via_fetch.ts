

async function main() {
    const baseUrl = "http://localhost:5000";
    const loginUrl = `${baseUrl}/api/login`;
    const rolesUrl = `${baseUrl}/api/roles`;

    // 1. Login
    console.log("Logging in...");
    const loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" })
    });

    if (!loginRes.ok) {
        console.error("Login failed:", loginRes.status, await loginRes.text());
        process.exit(1);
    }

    const cookie = loginRes.headers.get("set-cookie");
    console.log("Logged in. Cookie:", cookie ? "Present" : "Missing");

    const headers = {
        "Content-Type": "application/json",
        "Cookie": cookie || ""
    };

    // 2. Fetch Roles
    console.log("\nFetching Roles...");
    const rolesRes = await fetch(rolesUrl, { headers });
    console.log("Roles Status:", rolesRes.status);
    if (rolesRes.ok) {
        console.log("Roles Body:", await rolesRes.json());
    } else {
        console.log("Roles Error:", await rolesRes.text());
    }

    // 3. Create Role
    console.log("\nCreating Role 'DebugRole_Fetch'...");
    const createRes = await fetch(rolesUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
            name: "DebugRole_Fetch",
            description: "Created via fetch script",
            permissions: []
        })
    });
    console.log("Create Status:", createRes.status);
    console.log("Create Body:", await createRes.text());
}

main();
