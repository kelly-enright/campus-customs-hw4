import { useCallback, useState } from "react";

/**
 * Makes the tile behind a product photo match that photo's own background.
 *
 * The catalogue images are inconsistent — some shot on white, some on black — which made
 * the grid look patchy. CSS can't fix that: `multiply` keeps black black and `screen`
 * blows out white. So instead of forcing the photos to match the tile, we make the tile
 * match the photo: draw the image tiny, read its corner pixels, and paint the surrounding
 * tile that colour. Every card then looks deliberately mounted.
 *
 * Returns a *ref callback* rather than an onLoad handler because a cached image can
 * finish loading before React attaches a handler — that image would never fire `load`
 * and would keep the default tile. The ref checks `complete` first and only listens when
 * the image is genuinely still loading.
 *
 * The images are served from our own API, so the canvas stays untainted and readable.
 */
export function useTileColor() {
  const [tileColor, setTileColor] = useState<string | null>(null);

  const sample = useCallback((img: HTMLImageElement) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      // willReadFrequently: this canvas exists only to be read back with getImageData,
      // so keep it on the CPU. Without it the browser warns once per card — 102 of them
      // on the catalogue page.
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 8, 8);
      // Average the four corners: one stray dark pixel shouldn't decide the tile.
      const corners = [
        ctx.getImageData(0, 0, 1, 1).data,
        ctx.getImageData(7, 0, 1, 1).data,
        ctx.getImageData(0, 7, 1, 1).data,
        ctx.getImageData(7, 7, 1, 1).data,
      ];
      const [r, g, b] = [0, 1, 2].map((channel) =>
        Math.round(corners.reduce((sum, px) => sum + px[channel], 0) / corners.length),
      );
      setTileColor(`rgb(${r}, ${g}, ${b})`);
    } catch {
      // Canvas unreadable — keep the default tile.
    }
  }, []);

  const imageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node) return;
      if (node.complete && node.naturalWidth > 0) {
        sample(node);
      } else {
        node.addEventListener("load", () => sample(node), { once: true });
      }
    },
    [sample],
  );

  return { tileColor, imageRef };
}
