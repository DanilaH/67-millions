import type Phaser from 'phaser';

/** Fit real rendered glyphs inside a text slot before a button adds its padding. */
export const fitPanelText = <T extends Phaser.GameObjects.Text>(text: T, width: number, height: number, wrap = true): T => {
  text.setFixedSize(0, 0).setPadding(0).setWordWrapWidth(wrap ? width : 0, true);
  let size = Number.parseFloat(String(text.style.fontSize));
  while ((text.width > width || text.height > height) && size > 12) text.setFontSize(--size);
  return text;
};
