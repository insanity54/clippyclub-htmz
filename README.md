# Clipstr Club

## design requirements

    1. Must work
    2. Must be fast
    3. Must make money
    4. Must exist in a single git repository
    5. K.I.S.S.


## reference

[ffmpeg-script-generator](https://romander.github.io/ffmpeg-script-generator/)


## text overlay example

```
ffmpeg -y -f lavfi -i color=color=black:size=1920x1080 -i /home/chris/.local/state/clippyclub/compilation_6.mp4 -filter_complex "[0:v]format=yuva444p,colorchannelmixer=aa=0.5[titlebar];[1:v][titlebar]overlay=y=5*h/7,drawtext=textfile=test.txt:alpha='if(gte(t,8),0,0.8)':fontsize=h/18:fontcolor=white:fontfile=/home/chris/Documents/clippyclub-htmz/assets/PatuaOne-Regular.ttf:y=h-h/18-th:x='if(gte(t,3),h/18,h/18*(1-pow(1-t/3,4)))'" -t 10 ~/Downloads/comp16-test.mp4 && open ~/Downloads/comp16-test.mp4
```


## domain name ideas

clippypill.me
clipster.cc
clipster.pro
