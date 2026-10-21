import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";

// The built ESM bundles for the browser without @aws-sdk/client-s3 and node:fs.
// Run after pnpm build: a static import() of either would fail to resolve here.

await build({
	stdin: {
		contents: `import { SquareCloudBlob } from "./lib/index.mjs";
new SquareCloudBlob("squp_x").put(new Blob(["a"]), { name: "a" });`,
		resolveDir: `${import.meta.dirname}/..`,
	},
	bundle: true,
	platform: "browser",
	write: false,
	logLevel: "silent",
	plugins: [
		{
			// The peer is a devDependency, so pretend it is not installed
			name: "no-aws-sdk",
			setup(build) {
				build.onResolve({ filter: /^@aws-sdk\// }, () => ({
					errors: [{ text: "@aws-sdk/client-s3 is not installed" }],
				}));
			},
		},
	],
});

// Metro fails on an import() it cannot resolve unless it is optional: chained to .catch()
const source = readFileSync(`${import.meta.dirname}/../lib/index.mjs`, "utf8");
const imports = source.match(/\bimport\(/g) ?? [];
assert.ok(imports.length > 0);
assert.equal(
	source.match(/\bimport\([^)]*\)\.catch\(/g)?.length,
	imports.length,
);
