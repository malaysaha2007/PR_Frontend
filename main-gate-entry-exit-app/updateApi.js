const fs = require("fs");
const axios = require("axios");

async function updateAPI() {
  try {
    const res = await axios.get("http://127.0.0.1:4040/api/tunnels");

    const tunnels = res.data.tunnels;

    const httpsTunnel = tunnels.find(t => t.public_url.startsWith("https"));

    if (!httpsTunnel) {
      console.log("No HTTPS tunnel found");
      return;
    }

    const url = httpsTunnel.public_url;

    console.log("Ngrok URL:", url);

    fs.writeFileSync(
      "./apiConfig.json",
      JSON.stringify({ API_BASE: url }, null, 2)
    );

    console.log("API updated successfully!");
  } catch (err) {
    console.log("Error fetching ngrok URL:", err.message);
  }
}

updateAPI();