#!/bin/bash

ffmpeg -y \
  -filter_complex "
    color=color=0x00000000:size=1920x1080,trim=0:10[blue];
    color=color=black:size=1920x1080,format=gbrap10le,colorchannelmixer=aa=0.5[black];
    [blue]split[blue0][blue1];
    [blue0][black]
      overlay=y='if(gte(t,6),h,5*h/7)':
        repeatlast=0:
        shortest=1,
      drawtext=textfile=test.txt:
        alpha='if(gte(t,6),0,0.8)':
        fontsize=h/18:fontcolor=white:
        fontfile=/home/chris/Documents/clippyclub-htmz/assets/PatuaOne-Regular.ttf:
        y=h-h/18-th:
        x='if(gte(t,3),h/18,h/18*(1-pow(1-t/3,4)))',
      trim=0:10[title];
    [blue1][title]xfade=transition=fade:duration=1[video];
  " \
  -map '[video]' \
  -fps_mode cfr \
  -c:v ffv1 \
  ~/Downloads/comp16-test.nut \
  && ffplay ~/Downloads/comp16-test.nut
