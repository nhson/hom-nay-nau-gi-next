// Renders the PWA icons from the two SVG sources. Run after changing the artwork:
//   pnpm icons
// The PNGs are committed, so builds never need sharp.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const OUT = "public/icons";

async function render(source: string, size: number, target: string) {
  const svg = await readFile(`${OUT}/${source}`);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(target);
}

async function main() {
  await render("icon.svg", 192, `${OUT}/icon-192.png`);
  await render("icon.svg", 512, `${OUT}/icon-512.png`);
  await render("maskable.svg", 512, `${OUT}/maskable-512.png`);
  // iOS ignores transparency and rounds the corners itself, so it gets the full-bleed artwork.
  await render("maskable.svg", 180, "src/app/apple-icon.png");
  await writeFile("src/app/icon.svg", await readFile(`${OUT}/icon.svg`));
  console.log("icons written");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
