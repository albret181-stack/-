# Public synthetic board: standard library only, no private image data.
import struct,zlib
w,h=512,1108
rows=[]
for y in range(h):
 row=bytearray([0])
 for x in range(w):
  rgb=(30,30,30)
  if 300<=y<812: rgb=(118,150,86) if ((y-300)//64+x//64)%2 else (238,238,210)
  row.extend(rgb)
 rows.append(row)
def chunk(kind,data):
 return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
with open('/tmp/chess-synthetic.png','wb') as f:
 f.write(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b''))
