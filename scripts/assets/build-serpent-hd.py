"""Pack high-resolution generated keyframes and bidirectional motion fields.
Run with pillow, numpy and opencv-python-headless installed.
Motion is interpolated continuously by WebGL; no frame atlas or video seeking.
"""
from pathlib import Path
from PIL import Image
import numpy as np,cv2,json
root=Path(__file__).resolve().parents[2]
out=root/'public/images/serpent-hd';out.mkdir(exist_ok=True)
frames=[]
for batch in range(3):
 sheet=Image.open(root/f'docs/assets/serpent-hd-sheet-{batch}.png').convert('RGB')
 w,h=sheet.width//2,sheet.height//2
 for j in range(4):
  # Uniform quadrant extraction; no upscaling or numbered headers.
  im=sheet.crop(((j%2)*w,(j//2)*h,(j%2+1)*w,(j//2+1)*h))
  im.save(out/f'pose-{len(frames):02d}.webp',quality=96,method=6)
  frames.append(np.asarray(im))
flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
flow.setFinestScale(0);flow.setGradientDescentIterations(60);flow.setVariationalRefinementIterations(15)
size=512
def field(a,b):
 a=cv2.resize(a,(size,size),interpolation=cv2.INTER_AREA);b=cv2.resize(b,(size,size),interpolation=cv2.INTER_AREA)
 f=flow.calc(cv2.cvtColor(a,cv2.COLOR_RGB2GRAY),cv2.cvtColor(b,cv2.COLOR_RGB2GRAY),None)
 # Encode signed UV displacement in two 16-bit pairs, independent of image resolution.
 f=cv2.GaussianBlur(f,(0,0),3.5)
 f=cv2.resize(f,(256,256),interpolation=cv2.INTER_AREA)
 q=np.round((np.clip(f/size,-.5,.5)+.5)*65535).astype(np.uint16)
 rgba=np.empty((256,256,4),np.uint8)
 rgba[:,:,0]=q[:,:,0]>>8;rgba[:,:,1]=q[:,:,0]&255
 rgba[:,:,2]=q[:,:,1]>>8;rgba[:,:,3]=q[:,:,1]&255
 return Image.fromarray(rgba)
for i in range(11):
 field(frames[i],frames[i+1]).save(out/f'forward-{i:02d}.png')
 field(frames[i+1],frames[i]).save(out/f'backward-{i:02d}.png')
 print(f'Flow pair {i+1}/11',flush=True)
(out/'manifest.json').write_text(json.dumps({'count':12,'width':w,'height':h,'flowSize':256,'encoding':'RGBA: x16 high/low, y16 high/low; UV offset = uint16/65535 - .5','source':'AI-restored keyframes based on the supplied storyboard and original serpent','interpolation':'continuous bidirectional optical-flow warping'},indent=2))
print(w,h,sum(p.stat().st_size for p in out.iterdir()))
