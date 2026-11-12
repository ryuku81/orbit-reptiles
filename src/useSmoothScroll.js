import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let activeScroll = null;

export function scrollToSection(id, immediate = false) {
  const target = document.getElementById(id);
  if (!target) return;
  if (activeScroll) {
    // Reconcile native scroll restoration or an unfinished wheel gesture first.
    activeScroll.scrollTo(window.scrollY, { immediate: true });
    activeScroll.scrollTo(target, { immediate });
  }
  else target.scrollIntoView({ behavior: immediate ? 'instant' : 'smooth' });
}

// Keep native touch and nested controls; only soften desktop wheel movement.
export default function useSmoothScroll(disabled) {
  useEffect(() => {
    if (disabled) return;
    const scroller = new Lenis({
      autoRaf: true,
      lerp: .14,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: .95,
      anchors: true,
      prevent: node => node.matches?.('dialog, .official-model-viewer, input, textarea, select, [data-native-scroll]'),
    });
    activeScroll = scroller;
    return () => {
      if (activeScroll === scroller) activeScroll = null;
      scroller.destroy();
    };
  }, [disabled]);
}
