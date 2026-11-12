import OfficialModelViewer from './OfficialModelViewer.jsx';
import { MODELS } from './model-sources.js';

export default function SpecimenScene({ species='lg', paused=false, interactive=false, className='' }) {
  return <div className={`specimen-scene ${className}`} style={{width:'100%',height:'100%',position:'relative',overflow:'hidden',pointerEvents:interactive?'auto':'none'}}><OfficialModelViewer model={MODELS[species]||MODELS.lg} paused={paused} autoRotate interactive={interactive} allowPageScroll/></div>;
}
