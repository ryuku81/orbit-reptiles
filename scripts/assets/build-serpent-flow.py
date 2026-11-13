"""Extract 45 storyboard panels and produce motion-compensated in-between frames.
Requirements: numpy, pillow, opencv-python-headless. No generated replacement artwork.
The identical 29px header crop excludes printed numbers on every source panel.
"""
from pathlib import Path
import sys,json,shutil
import numpy as np
import cv2
from PIL import Image
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]);sheet=Image.open(source).convert('RGB')
w,h=166,174;steps=6;columns=16
frames=[];crops=[]
for r in range(5):
 for c in range(9):
  x=round(c*sheet.width/9)+2;y=round(r*sheet.height/5)+29
  crop=(x,y,x+w,y+h);crops.append(crop)
  frames.append(np.asarray(sheet.crop(crop)))
count=(len(frames)-1)*steps+1
atlas=Image.new('RGB',(columns*w,((count+columns-1)//columns)*h))
folder=root/'public/images/serpent-sequence';folder.mkdir(parents=True,exist_ok=True)
flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
flow.setFinestScale(0);flow.setGradientDescentIterations(40);flow.setVariationalRefinementIterations(10)
yy,xx=np.mgrid[0:h*2,0:w*2].astype(np.float32)
def put(arr,index):
 image=Image.fromarray(arr);atlas.paste(image,((index%columns)*w,(index//columns)*h))
 if index==0:image.save(folder/'flow-poster.webp',lossless=True)
for i in range(len(frames)-1):
 a=cv2.resize(frames[i],(w*2,h*2),interpolation=cv2.INTER_CUBIC)
 b=cv2.resize(frames[i+1],(w*2,h*2),interpolation=cv2.INTER_CUBIC)
 ga=cv2.cvtColor(a,cv2.COLOR_RGB2GRAY);gb=cv2.cvtColor(b,cv2.COLOR_RGB2GRAY)
 ab=flow.calc(ga,gb,None);ba=flow.calc(gb,ga,None)
 put(frames[i],i*steps)
 for k in range(1,steps):
  t=k/steps
  # Warp both source poses towards the same intermediate geometry before blending.
  wa=cv2.remap(a,xx-t*ab[:,:,0],yy-t*ab[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
  wb=cv2.remap(b,xx-(1-t)*ba[:,:,0],yy-(1-t)*ba[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
  merged=cv2.addWeighted(wa,1-t,wb,t,0)
  put(cv2.resize(merged,(w,h),interpolation=cv2.INTER_AREA),i*steps+k)
 print(f'Interpolated {i+1}/44',flush=True)
put(frames[-1],count-1)
atlas.save(folder/'flow-atlas.webp',quality=94,method=6)
(folder/'flow-manifest.json').write_text(json.dumps({'count':count,'columns':columns,'width':w,'height':h,'sourceCount':45,'stepsPerPair':steps,'method':'bidirectional DIS optical flow','headerCrop':29,'crops':crops},indent=2))
shutil.copy2(source,root/'docs/assets/serpent-flow-source.png')
# A small review sheet containing actual source endpoints and motion-compensated poses.
review=Image.new('RGB',(w*8,h*3))
for j,index in enumerate(np.linspace(0,count-1,24).round().astype(int)):
 x=(index%columns)*w;y=(index//columns)*h
 review.paste(atlas.crop((x,y,x+w,y+h)),((j%8)*w,(j//8)*h))
review.save(root/'.qa/flow-review.png')
print(json.dumps({'count':count,'bytes':(folder/'flow-atlas.webp').stat().st_size}))
