"""Build 28 detailed, transparent poses guided by the user's 70-panel storyboard.
Requires numpy, pillow, opencv-python-headless. This pipeline only splits assets,
encodes WebP and computes motion vectors; it never masks away snake anatomy.
"""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,json
root=Path(__file__).resolve().parents[2]
out=root/'public/images/serpent-fine';out.mkdir(exist_ok=True)
frames=[];sizes=[]
for batch in range(7):
 sheet=Image.open(root/f'docs/assets/serpent-fine-sheet-{batch}.png').convert('RGBA')
 w,h=sheet.width//2,sheet.height//2
 for j in ([2,3,0,1] if batch==2 else range(4)):
  im=sheet.crop(((j%2)*w,(j//2)*h,(j%2+1)*w,(j//2+1)*h))
  assert im.getchannel('A').getextrema()[0]==0,'Transparent background is required'
  if im.size!=(512,768):
   from PIL import ImageOps
   im=ImageOps.pad(im,(512,768),method=Image.Resampling.LANCZOS,color=(0,0,0,0))
  im.save(out/f'pose-{len(frames):02d}.webp',quality=96,method=6)
  rgba=np.asarray(im).astype(np.float32)
  frames.append((rgba[:,:,:3]*rgba[:,:,3:4]/255).astype(np.uint8));sizes.append(im.size)
flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
flow.setFinestScale(0);flow.setGradientDescentIterations(60);flow.setVariationalRefinementIterations(15)
size=512
def field(a,b):
 a=cv2.resize(a,(size,size),interpolation=cv2.INTER_AREA);b=cv2.resize(b,(size,size),interpolation=cv2.INTER_AREA)
 f=flow.calc(cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),cv2.cvtColor(b,cv2.COLOR_RGB2GRAY),None)
 f=cv2.resize(cv2.GaussianBlur(f,(0,0),3.5),(256,256),interpolation=cv2.INTER_AREA)
 q=np.round((np.clip(f/size,-.5,.5)+.5)*65535).astype(np.uint16)
 rgba=np.empty((256,256,4),np.uint8)
 rgba[:,:,0]=q[:,:,0]>>8;rgba[:,:,1]=q[:,:,0]&255
 rgba[:,:,2]=q[:,:,1]>>8;rgba[:,:,3]=q[:,:,1]&255
 return Image.fromarray(rgba)
for i in range(len(frames)-1):
 field(frames[i],frames[i+1]).save(out/f'forward-{i:02d}.png')
 field(frames[i+1],frames[i]).save(out/f'backward-{i:02d}.png')
 print(f'Flow pair {i+1}/27',flush=True)
(out/'manifest.json').write_text(json.dumps({'count':28,'width':512,'height':768,'flowSize':256,'allPosesTransparent':True,'bodyFadeMask':False,'sourcePanelIndices':[round(i*69/27) for i in range(28)],'source':'70-panel storyboard used as motion guide; 28 AI-restored poses','interpolation':'continuous bidirectional optical flow'},indent=2))
print('Total bytes:',sum(p.stat().st_size for p in out.iterdir()))
