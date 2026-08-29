import { errors, absolutePath } from "./context.mjs";
import {
  validatePackageShells,
  validateRootManifest,
  validateWorkspaceManifest,
} from "./manifests.mjs";
import { validateTypeScriptProfiles } from "./typescript.mjs";
import {
  reportBlockPackageManifests,
  validateBiomeConfiguration,
  validateBlockCategories,
  validateConfigurationFiles,
  validateRequiredFiles,
  validateWorkspaceRoots,
} from "./repository.mjs";

export function runWorkspaceVerification() {
  validateRequiredFiles();
  validateRootManifest();
  validateWorkspaceManifest();
  validateWorkspaceRoots();
  validatePackageShells();
  validateBlockCategories();
  validateConfigurationFiles();
  validateTypeScriptProfiles();
  validateBiomeConfiguration();
  reportBlockPackageManifests(absolutePath("blocks"));

  if (errors.length > 0) {
    console.error("Workspace verification failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error(
      "Fix the reported path or manifest and run pnpm check again.",
    );
    process.exitCode = 1;
  } else {
    process.stdout.write("Workspace verification passed.\n");
    process.stdout.write(
      "- 6 private workspaces and TypeScript profiles verified\n",
    );
    process.stdout.write(
      "- Schemas, Registry, and Core exports, builds, dependencies, and aliases verified\n",
    );
    process.stdout.write(
      "- Root Biome and remaining shell contracts verified\n",
    );
    process.stdout.write(
      "- 4 block categories verified outside the workspace\n",
    );
  }
}
