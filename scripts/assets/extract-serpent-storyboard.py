"""Extract the supplied 14x8 contact sheet; no generated replacement artwork.
Run with the source PNG path. The original panel order, including missing labels,
is retained as 112 visual frames, not misrepresented as 128 source images.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json,sys,shutil
root=Path(__file__).resolve().parents[2]
src=Path(sys.argv[1]);im=Image.open(src).convert('RGB')
xs=[0,104,208,312,415,519,622,725,829,932,1036,1139,1242,1344,1448]
ys=[0,152,294,436,574,707,828,949,1086]
labels=[[1,2,3,4,5,6,7,8,9,10,11,12,14,16],[17,18,19,20,21,22,23,24,26,27,28,29,30,31],[33,34,35,36,37,38,39,40,41,43,44,45,46,48],[49,50,51,52,53,54,55,56,57,59,60,61,62,64],[65,66,67,68,69,70,71,72,73,74,76,77,78,79],[81,82,83,84,85,86,88,89,90,91,92,94,95,96],[97,98,99,100,101,102,103,104,106,107,108,109,110,111],[113,114,115,116,117,118,120,120,122,123,124,125,127,128]]
# Standardize the panel rectangles and remove the label corners/grid lines.
w,h,cols=100,128,16
atlas=Image.new('RGBA',(w*cols,h*7),(0,0,0,0));records=[]
for row in range(8):
 for col in range(14):
  box=(xs[col]+3,ys[row]+3,xs[col+1]-3,ys[row+1]-3)
  frame=im.crop(box).convert('RGBA').resize((w,h),Image.Resampling.LANCZOS)
  # Remove only the label corner; retain the approaching forehead and eyes.
  alpha=Image.new('L',(w,h),255)
  for py in range(29):
   for px in range(47):
    edge=max(0,min(1,max((px-34)/12,(py-18)/10)))
    alpha.putpixel((px,py),round(255*edge*edge*(3-2*edge)))
  frame.putalpha(alpha)
  i=len(records);atlas.paste(frame,((i%cols)*w,(i//cols)*h));records.append({'index':i,'sourceLabel':labels[row][col],'crop':list(box)})
  if i==0:frame.save(root/'public/images/serpent-sequence/poster.webp',quality=94)
atlas.save(root/'public/images/serpent-sequence/atlas.webp',quality=94,method=6)
(root/'public/images/serpent-sequence/manifest.json').write_text(json.dumps({'count':112,'columns':cols,'width':w,'height':h,'frames':records},indent=2))
shutil.copy2(src,root/'docs/assets/serpent-storyboard-source.png')
print('Extracted',len(records),'frames;', (root/'public/images/serpent-sequence/atlas.webp').stat().st_size,'bytes')
