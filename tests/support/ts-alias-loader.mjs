import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolvePath(import.meta.dirname, "../..");

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier.startsWith("next/") &&
    existsSync(resolvePath(projectRoot, "node_modules", `${specifier}.js`))
  ) {
    return nextResolve(`${specifier}.js`, context);
  }

  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: "data:text/javascript,export%20{}%3B",
    };
  }

  if (specifier.startsWith("@/")) {
    const basePath = resolvePath(projectRoot, "src", specifier.slice(2));
    const candidate = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
    ].find(existsSync);

    if (!candidate) {
      throw new Error(`Test loader could not resolve ${specifier}.`);
    }

    return {
      shortCircuit: true,
      url: pathToFileURL(candidate).href,
    };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const basePath = resolvePath(
      fileURLToPath(new URL(".", context.parentURL)),
      specifier,
    );
    const candidate = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
    ].find(existsSync);

    if (candidate) {
      return {
        shortCircuit: true,
        url: pathToFileURL(candidate).href,
      };
    }
  }

  return nextResolve(specifier, context);
}
