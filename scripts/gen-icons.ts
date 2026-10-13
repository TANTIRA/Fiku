// Regenerates the static Fuku icons from the sprite: npx tsx scripts/gen-icons.ts
import { writeFileSync } from "node:fs";
import { spriteSvg } from "../src/components/fuku/sprite";

writeFileSync("src/app/icon.svg", spriteSvg("happy", 32));
writeFileSync("public/fuku.svg", spriteSvg("happy", 256));
console.log("wrote src/app/icon.svg, public/fuku.svg");
