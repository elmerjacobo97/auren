import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkspaceVerification } from "./verify-workspace/run.mjs";

export {
  expectedCliBin,
  expectedCliDependencies,
  expectedCliPaths,
  expectedCliScripts,
  expectedCoreExports,
  expectedCorePaths,
  expectedSchemasExports,
  expectedSchemasPaths,
  expectedWebDependencies,
  expectedWebDevDependencies,
  expectedWebScripts,
  expectedWorkspaceProfiles,
  expectedBlockCategories,
} from "./verify-workspace/context.mjs";

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runWorkspaceVerification();
}
