import fs from "fs";
import path from "path";

import satori from "satori";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const POWER_RED = "#dc2626";

async function main() {
  const fontDir = path.join(__dirname, "..", "public", "fonts");
  const backgroundPath = path.join(__dirname, "..", "public", "img", "sumo-deadlift.webp");
  const outputPath = path.join(__dirname, "..", "public", "img", "og.png");

  const interMedium = fs.readFileSync(path.join(fontDir, "Inter-Medium.ttf"));
  const interBold = fs.readFileSync(path.join(fontDir, "Inter-Bold.ttf"));
  const interExtraBold = fs.readFileSync(path.join(fontDir, "Inter-ExtraBold.ttf"));

  const resizedImage = await sharp(backgroundPath)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "center" })
    .toBuffer();

  const darkOverlay = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 0.9 },
    },
  })
    .png()
    .toBuffer();

  const background = await sharp(resizedImage)
    .composite([{ input: darkOverlay, blend: "over" }])
    .toBuffer();

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                fontSize: "20px",
                fontWeight: "500",
                color: POWER_RED,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "16px",
              },
              children: "Powerlifting Data API",
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: "72px",
                fontWeight: "800",
                color: "white",
                textAlign: "center",
                lineHeight: "1.1",
                letterSpacing: "-0.025em",
              },
              children: "Close Powerlifting",
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: "24px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "36px",
                      fontWeight: "800",
                      color: "white",
                      letterSpacing: "-0.025em",
                    },
                    children: "Build powerlifting apps",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "36px",
                      fontWeight: "800",
                      color: "#a3a3a3",
                      letterSpacing: "-0.025em",
                    },
                    children: "in minutes, not months",
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        {
          name: "Inter",
          data: interMedium,
          weight: 500,
          style: "normal",
        },
        {
          name: "Inter",
          data: interBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Inter",
          data: interExtraBold,
          weight: 800,
          style: "normal",
        },
      ],
    },
  );

  const textOverlay = await sharp(Buffer.from(svg)).png().toBuffer();

  await sharp(background)
    .composite([{ input: textOverlay, top: 0, left: 0 }])
    .png({ compressionLevel: 9, quality: 80 })
    .toFile(outputPath);

  console.log(`OG image generated at ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to generate OG image:", error);
  process.exit(1);
});
