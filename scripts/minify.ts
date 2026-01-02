import fs from "fs";
import path from "path";
// import { build } from "esbuild";
import { minify as minifyHtml } from "html-minifier-terser";
// import { minify as terserMinify } from "terser";

// const distDir = path.join(__dirname, "..", "dist");
const viewsDir = path.join(__dirname, "..", "src", "routes");
// const publicDir = path.join(__dirname, "..", "public");

function getAllFiles(dir: string, ext: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "fixtures") continue;
      getAllFiles(fullPath, ext, files);
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith(`.min${ext}`)) {
      files.push(fullPath);
    }
  }

  return files;
}

// // Note: figure out why it's stripping all comments even with legalComments: "inline"
// async function minifyJavaScript(): Promise<void> {
//   const distJsFiles = getAllFiles(distDir, ".js");
//   const publicJsFiles = getAllFiles(publicDir, ".js");
//   const jsFiles = [...distJsFiles, ...publicJsFiles];

//   console.log(`Minifying ${jsFiles.length} JavaScript files...`);

//   for (const file of jsFiles) {
//     const isBrowserFile = file.startsWith(publicDir);

//     await build({
//       entryPoints: [file],
//       outfile: file,
//       allowOverwrite: true,
//       minify: true,
//       minifyIdentifiers: !isBrowserFile,
//       minifySyntax: !isBrowserFile,
//       keepNames: true,
//       sourcemap: false,
//       target: isBrowserFile ? "es2020" : "node22",
//       platform: isBrowserFile ? "browser" : "node",
//       format: isBrowserFile ? "iife" : "cjs",
//       logLevel: "error",
//       legalComments: "inline", // 👈 keeps ALL comments
//     });
//   }

//   console.log(`Minified ${jsFiles.length} JavaScript files`);
// }

// async function minifyJavaScript(): Promise<void> {
//   // const distJsFiles = getAllFiles(distDir, ".js");
//   const publicJsFiles = getAllFiles(publicDir, ".js");
//   // const jsFiles = [...distJsFiles, ...publicJsFiles];
//   const jsFiles = publicJsFiles;

//   for (const file of jsFiles) {
//     const code = fs.readFileSync(file, "utf8");

//     const out = await terserMinify(code, {
//       compress: true,
//       mangle: true,
//       format: {
//         comments: true,
//       },
//     });

//     fs.writeFileSync(file, out.code ?? code, "utf8");
//   }
// }

async function minifyHtmlFiles(): Promise<void> {
  const htmlFiles = getAllFiles(viewsDir, ".html");

  console.log(`Minifying ${htmlFiles.length} HTML files...`);

  const minifyOptions = {
    collapseWhitespace: true,
    removeComments: true,
    removeOptionalTags: false,
    removeRedundantAttributes: false,
    removeScriptTypeAttributes: false,
    removeStyleLinkTypeAttributes: false,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: {
      compress: false,
      mangle: false,
      output: { comments: false },
    },
    conservativeCollapse: false,
    preserveLineBreaks: false,
    removeEmptyAttributes: true,
    removeAttributeQuotes: false,
    keepClosingSlash: true,
    ignoreCustomFragments: [/<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/],
  };

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, "utf8");
    const minified = (await minifyHtml(content, minifyOptions)) as string;
    fs.writeFileSync(file, minified, "utf8");
  }

  console.log(`Minified ${htmlFiles.length} HTML files`);
}

async function minifyAll(): Promise<void> {
  console.log("Starting minification...\n");

  // JS minification disabled for now - only doing CSS and HTML
  // await Promise.all([minifyJavaScript(), minifyHtmlFiles()]);
  await minifyHtmlFiles();

  console.log("\nMinification complete!");
}

minifyAll().catch((error) => {
  console.error("Minification failed:", error);
  process.exit(1);
});
