// esbuild.config.js
const esbuild = require("esbuild");

const isProduction = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');

async function build() {
    const ctx = await esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        platform: "node",
        target: "node20",
        external: ["vscode"],
        outfile: "dist/extension.js",
        sourcemap: !isProduction,
        minify: isProduction,
    });

    if (isWatch) {
        await ctx.watch();
        console.log("👀 Watching for changes...");
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log("✅ Build complete");
    }
}

build().catch((err) => {
    console.error("❌ Build failed:", err);
    process.exit(1);
});
