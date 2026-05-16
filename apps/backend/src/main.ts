import { readConfig } from "./data/config";
import { makeDevelopmentDependencies } from "./environments/development";
import { makeProductionDependencies } from "./environments/production";
import { createApp } from "./program";

const config = readConfig(process.env);
const dependencies =
  config.appEnv === "production"
    ? makeProductionDependencies(config)
    : makeDevelopmentDependencies(config);

const app = createApp(dependencies, config.appEnv);

app.listen(config.port, () => {
  console.info(
    JSON.stringify({
      level: "info",
      message: "backend_started",
      port: config.port,
      appEnv: config.appEnv
    })
  );
});
