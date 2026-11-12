import OfficialModelViewer from './OfficialModelViewer.jsx';
import { MODELS } from './model-sources.js';

export default function ReptileScene({ paused=false, autoRotate=true, focus='full', resetKey=0, allowPageScroll=false, onReady }) {
  return <div className="reptile-scene-host" style={{position:'absolute',inset:0,overflow:'hidden'}}><OfficialModelViewer model={MODELS.chameleon} paused={paused} autoRotate={autoRotate} focus={focus} resetKey={resetKey} interactive allowPageScroll={allowPageScroll} onReady={onReady}/></div>;
}
