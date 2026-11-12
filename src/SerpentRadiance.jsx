import LivingPortraitEffect from './LivingPortraitEffect.jsx';

export default function SerpentRadiance({ paused = false, progress }) {
  return <LivingPortraitEffect variant="serpent" paused={paused} progress={progress} className="serpent-radiance"/>;
}
