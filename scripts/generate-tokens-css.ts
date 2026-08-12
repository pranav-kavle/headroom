import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokensCss } from "@headroom/tokens";

const target = fileURLToPath(new URL("../src/app/tokens.css", import.meta.url));
writeFileSync(target, tokensCss(), "utf8");
console.log(`wrote ${target}`);
