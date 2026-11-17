import {tokens} from '../../tokens';
import type {Easing} from './easing';
import {parseDuration, parseEasing} from './easing';

export type MotionTiming = {
  fadeDuration: number;
  fadeEasing: Easing;
  enterDuration: number;
  enterEasing: Easing;
  sparklineDuration: number;
  barDuration: number;
  barStagger: number;
  barStaggerMax: number;
  seriesStagger: number;
  extensionDelay: number;
  updateDuration: number;
  updateEasing: Easing;
  shimmerDuration: number;
  pulseDuration: number;
};

const {motion} = tokens;

export const TIMING: MotionTiming = {
  fadeDuration: parseDuration(motion.fadeDuration),
  fadeEasing: parseEasing(motion.fadeEasing),
  enterDuration: parseDuration(motion.enterDuration),
  enterEasing: parseEasing(motion.enterEasing),
  sparklineDuration: parseDuration(motion.sparklineDuration),
  barDuration: parseDuration(motion.barDuration),
  barStagger: parseDuration(motion.barStagger),
  barStaggerMax: parseDuration(motion.barStaggerMax),
  seriesStagger: parseDuration(motion.seriesStagger),
  extensionDelay: parseDuration(motion.extensionDelay),
  updateDuration: parseDuration(motion.updateDuration),
  updateEasing: parseEasing(motion.updateEasing),
  shimmerDuration: parseDuration(motion.shimmerDuration),
  pulseDuration: parseDuration(motion.pulseDuration),
};
