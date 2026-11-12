import { useEffect } from 'react';
import { useMotionValue } from 'motion/react';

// A paused experience retains its current composition while normal scrolling still works.
export default function useFrozenMotion(source, paused, resetValue) {
  const frozen = useMotionValue(paused && resetValue !== undefined ? resetValue : source.get());
  useEffect(() => {
    if (paused) {
      if (resetValue !== undefined) frozen.set(resetValue);
      return;
    }
    frozen.set(source.get());
    return source.on('change', value => frozen.set(value));
  }, [source, frozen, paused, resetValue]);
  return frozen;
}
