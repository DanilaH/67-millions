import type { BarePlinkoCallbacks } from './createBarePlinko';

export const PEG_LABEL_PREFIX = 'plinko:peg:';
export const BALL_LABEL = 'plinko:ball';
export const POCKET_SENSOR_LABEL_PREFIX = 'plinko:pocket:';

/** Phaser's extra bodyA/bodyB arguments describe only the last pair in the batch. */
export const dispatchPlinkoCollisions = (
  pairs: readonly { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[],
  callbacks: BarePlinkoCallbacks,
): void => {
  for (const { bodyA, bodyB } of pairs) {
    const ball = bodyA.label === BALL_LABEL ? bodyA : bodyB.label === BALL_LABEL ? bodyB : null;
    if (!ball) continue;
    const other = bodyA === ball ? bodyB : bodyA;
    if (other.label.startsWith(POCKET_SENSOR_LABEL_PREFIX)) {
      const index = Number(other.label.slice(POCKET_SENSOR_LABEL_PREFIX.length));
      if (Number.isInteger(index)) callbacks.onPocket?.(index, ball);
    } else if (other.label.startsWith(PEG_LABEL_PREFIX)) {
      callbacks.onPeg?.(other.label.slice(PEG_LABEL_PREFIX.length), ball);
    }
  }
};
