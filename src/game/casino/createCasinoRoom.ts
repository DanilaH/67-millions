import type Phaser from 'phaser';
import { productionArtKey } from '../visual/productionArt';
import { isPlinkoPerfMode } from '../../app/perfMode';
import { sceneViewport } from '../visual/scenePresentation';

/** A fixed-cost backdrop: walls, floor perspective, lamps and neighbouring machines. */
export const createCasinoRoom = (scene: Phaser.Scene, parent: Phaser.GameObjects.Container): void => {
  const g = scene.add.graphics().setVisible(false);
  const key = '67m:casino-room';
  const image = scene.add.image(0, 0, '__WHITE').setVisible(false); parent.add(image);
  const draw = () => {
    const v = sceneViewport(scene), right = v.left + v.width, bottom = v.top + v.height;
    g.clear().save().translateCanvas(-v.left, -v.top);
    g.fillStyle(0x241f1c).fillRect(v.left, v.top, v.width, v.height);
    g.fillStyle(0x342b26).fillRect(v.left, 110, v.width, 390);
    // Uneven plaster lines and dark wooden wall panels.
    for (let x = Math.floor(v.left / 90) * 90; x < right; x += 90) {
      g.fillStyle(0x211c19).fillRect(x + 4, 320, 82, 182);
      g.lineStyle(2, 0x594535, 0.7).strokeRect(x + 10, 328, 70, 164);
      g.lineStyle(1, 0x6e5741, 0.14).lineBetween(x + 18, 135, x + 40, 301);
    }
    g.fillStyle(0x62503a).fillRect(v.left, 316, v.width, 5);
    g.fillStyle(0x181918).fillRect(v.left, 501, v.width, bottom - 501);
    g.lineStyle(2, 0x574437, 0.5);
    for (let x = v.left - 400; x < right + 400; x += 110) g.lineBetween(640 + (x - 640) * 0.55, 501, x, bottom);
    for (let y = 523; y < bottom; y += (y - 480) * 0.4) g.lineBetween(v.left, y, right, y);
    // Worn runner leading to the central machine.
    g.fillStyle(0x492a29).fillTriangle(445, 500, 835, 500, 950, bottom).fillTriangle(445, 500, 950, bottom, 330, bottom);
    for (const x of [v.left + 120, right - 100]) {
      g.lineStyle(3, 0x100f0d).lineBetween(x, v.top, x, 140);
      g.fillStyle(0xc78b42, 0.05).fillTriangle(x, 140, x - 140, 490, x + 140, 490);
      g.fillStyle(0x7f623e).fillEllipse(x, 137, 70, 18);
      g.fillStyle(0xffd891).fillEllipse(x, 145, 40, 8);
    }
    // Silhouettes of other cabinets establish an interior, not an outdoor map.
    for (const x of [v.left + 45, right - 105]) {
      g.fillStyle(0x151717).fillRoundedRect(x, 370, 85, 190, 7);
      g.lineStyle(3, 0x6a4c33).strokeRoundedRect(x, 370, 85, 190, 7);
      g.fillStyle(0x725237).fillRect(x + 10, 384, 65, 14);
      g.fillStyle(0x34413a).fillRect(x + 10, 410, 65, 66);
      for (let i = 0; i < 3; i++) g.fillStyle(0xc0ae7c, 0.5).fillRect(x + 15 + i * 20, 428, 14, 28);
      g.fillStyle(0xa27a42).fillCircle(x + 62, 495, 7);
    }
    g.restore();
    image.setTexture('__WHITE');
    if (scene.textures.exists(key)) scene.textures.remove(key);
    g.generateTexture(key, Math.ceil(v.width), Math.ceil(v.height));
    const canvas = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    context.drawImage(scene.textures.get(productionArtKey('casino')).getSourceImage() as CanvasImageSource, 340 - v.left, 85 - v.top, 600, 590);
    // Browser-composited static art avoids replaying a full-screen texture in
    // the software WebGL renderer on every fixed physics frame.
    scene.game.canvas.style.backgroundImage = isPlinkoPerfMode() && new URLSearchParams(location.search).get('art') === 'off'
      ? '' : `url(${canvas.toDataURL('image/png')})`;
    scene.textures.remove(key);
    g.clear();
  };
  draw(); scene.scale.on('resize', draw);
  scene.events.once('shutdown', () => { scene.scale.off('resize', draw); if (scene.textures.exists(key)) scene.textures.remove(key); });
};
