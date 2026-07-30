const fs = require("fs/promises");
const path = require("path");

const projectDir = path.resolve(__dirname, "..");
const workspaceDir = path.resolve(projectDir, "..");
const outputDir = path.join(projectDir, "_site");
const resourceDir = path.join(workspaceDir, "resource");
const staticExcludes = new Set([
  "_site",
  "data",
  "functions",
  "scripts",
  "supabase",
  "node_modules",
  ".git",
  ".wrangler",
  ".gitignore",
  "DEPLOY.md",
  "package.json",
  "wrangler.toml",
]);

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function copyDirectory(source, target, shouldSkip = () => false) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, shouldSkip);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function findReferencedResources() {
  const filesToScan = ["index.html", "styles.css"];
  const references = new Set();
  const patterns = [
    /\.\.\/resource\/([^"'()\s>]+)/g,
    /\/resource\/([^"'()\s>]+)/g,
  ];

  for (const file of filesToScan) {
    const content = await fs.readFile(path.join(projectDir, file), "utf8");
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        references.add(decodeURIComponent(match[1]));
      }
    }
  }

  return [...references];
}

async function copyReferencedResources() {
  const references = await findReferencedResources();
  for (const relative of references) {
    const source = path.resolve(resourceDir, relative);
    const target = path.resolve(outputDir, "resource", relative);

    if (!source.startsWith(resourceDir)) {
      throw new Error(`Invalid resource path: ${relative}`);
    }

    await copyFile(source, target);
  }

  return references.length;
}

async function build() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await copyDirectory(projectDir, outputDir, (name) => staticExcludes.has(name));
  const resourceCount = await copyReferencedResources();
  console.log(`Built ${outputDir}`);
  console.log(`Copied ${resourceCount} referenced resource files.`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
