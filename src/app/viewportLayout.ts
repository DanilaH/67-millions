/** Expand the visible world, never stretch gameplay geometry. */
export const resolveGameViewport = (width: number, height: number) => {
  const scale = Math.min(width / 1280, height / 720);
  const worldWidth = width / scale;
  const worldHeight = height / scale;
  return { scale, width: worldWidth, height: worldHeight, left: (1280 - worldWidth) / 2, top: (720 - worldHeight) / 2 };
};
