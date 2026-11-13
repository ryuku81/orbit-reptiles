"""Pack the user's 4x4 sheet without rescaling, masking, or reconstructing artwork.
Only grid separator pixels are excluded. Narrow source panels are centered in
transparent padding, preserving their original aspect ratio and every face.
"""
from pathlib import Path
from PIL import Image
import json,sys,shutil
root=Path(__file__).resolve().parents[2];source=Path(sys.argv[1]);im=Image.open(source).convert('RGBA')
xs=[(2,294),(298,589),(593,884),(888,1122)]
ys=[(2,348),(352,698),(702,1048),(1052,1402)]
w,h,pad=292,350,12;tilew,tileh=w+2*pad,h+2*pad
atlas=Image.new('RGBA',(tilew*4,tileh*4),(0,0,0,0));records=[]
folder=root/'public/images/serpent-sequence';folder.mkdir(parents=True,exist_ok=True)
for row,(top,bottom) in enumerate(ys):
 for col,(left,right) in enumerate(xs):
  crop=(left,top,right,bottom);frame=im.crop(crop)
  tile=Image.new('RGBA',(tilew,tileh),(0,0,0,0));offset=(pad+(w-frame.width)//2,pad+(h-frame.height)//2);tile.paste(frame,offset)
  i=row*4+col;atlas.paste(tile,(col*tilew,row*tileh));records.append({'index':i,'sourceLabel':i+1,'crop':crop,'offset':offset,'nativeSize':frame.size})
  if not i:tile.save(folder/'undulation-poster.webp',lossless=True,method=6)
atlas.save(folder/'undulation-atlas.webp',lossless=True,method=6)
(folder/'undulation-manifest.json').write_text(json.dumps({'count':16,'columns':4,'width':tilew,'height':tileh,'padding':pad,'rescaled':False,'frames':records},indent=2))
shutil.copy2(source,root/'docs/assets/serpent-undulation-source.png')
print('16 original-resolution panels:',tilew,tileh,'atlas bytes:',(folder/'undulation-atlas.webp').stat().st_size)
