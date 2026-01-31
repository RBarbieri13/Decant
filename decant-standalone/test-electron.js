const { app } = require("electron"); console.log("app type:", typeof app); app.on("ready", () => { console.log("APP READY\!"); app.quit(); });
