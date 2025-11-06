import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const filesToCopy = ["index.html", "app.js", "styles.css"];

async function build() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await Promise.all(
    filesToCopy.map(async (file) => {
      const source = path.join(rootDir, file);
      const destination = path.join(distDir, file);
      await fs.copyFile(source, destination);
    })
  );

  console.log(`Build terminé. Fichiers copiés vers ${distDir}`);
}

build().catch((error) => {
  console.error("La construction a échoué :", error);
  process.exit(1);
});
