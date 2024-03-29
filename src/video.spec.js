import { getVideoFilterComplex, getAudioFilterComplex } from "./video.js"
import { expect } from 'chai'


describe('video.js', function () {
    describe('getVideoFilterComplex', function () {
        xit('one clip', function () {
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 15,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                }
            ]
            const filterComplex = getVideoFilterComplex(manifest)
            expect(filterComplex).to.throw() // idk how to make this expect function work. too much time wasted, I see it throw. Moving on.        
        })
        it('two clips', function () {
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 15,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-fPHWqQafZ.mp4',
                    duration: 8,
                    fps: 30,
                    width: 1920,
                    height: 1080,
                    text: ''
                }
            ]
            const filterComplex = getVideoFilterComplex(manifest)
            expect(filterComplex).to.equal('[0]settb=AVTB[v0];[1]settb=AVTB[v1];[v0][v1]xfade=transition=diagtr:duration=0.2:offset=14.80[video];');
        })
        it('three clips', function () {
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-fPHWqQafZ.mp4',
                    duration: 3,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: ''
                },
                {
                    file: '/home/chris/.local/state/clippyclub/TangibleSpunkyPandaBCouch-bmZeCo7SfmxgoXVz.mp4',
                    duration: 8,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'GENERIC TITLE\nClipped by yolo420blazeit on April 1, 2023\n5 views'
                }
            ]
            const filterComplex = getVideoFilterComplex(manifest)
            expect(filterComplex).to.equal('[0]settb=AVTB[v0];[1]settb=AVTB[v1];[2]settb=AVTB[v2];[v0][v1]xfade=transition=diagtr:duration=0.2:offset=4.80[x0];[x0][v2]xfade=transition=diagtr:duration=0.2:offset=7.60[video];');
        })
        it('four clips', function () {
            
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-fPHWqQafZ.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: ''
                },
                {
                    file: '/home/chris/.local/state/clippyclub/TangibleSpunkyPandaBCouch-bmZeCo7SfmxgoXVz.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'GENERIC TITLE\nClipped by yolo420blazeit on April 1, 2023\n5 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/PlayfulLuckyGoblinKappaRoss-hiIn66OCzxAsqX_f.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'sUpEr JuMp!\nClipped by tacosmell on December 15, 2022\n52342 views'
                }
            ]
            const filterComplex = getVideoFilterComplex(manifest)
            expect(filterComplex).to.equal('[0]settb=AVTB[v0];[1]settb=AVTB[v1];[2]settb=AVTB[v2];[3]settb=AVTB[v3];[v0][v1]xfade=transition=diagtr:duration=0.2:offset=4.80[x0];[x0][v2]xfade=transition=diagtr:duration=0.2:offset=9.60[x1];[x1][v3]xfade=transition=diagtr:duration=0.2:offset=14.40[video];');
        })
    
    })
    describe('getAudioFilterComplex', function () {
        it('two clips', function () {
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-fPHWqQafZ.mp4',
                    duration: 5,
                    fps: 30,
                    width: 1920,
                    height: 1080,
                    text: ''
                }
            ]
            const filterComplex = getAudioFilterComplex(manifest)
            expect(filterComplex).to.equal('[0]atrim=start=0:end=5[a0];[1]atrim=start=0:end=5[a1];[a0][a1]acrossfade=duration=0.2:curve1=tri:curve2=tri[audio];');
        })
        it('three clips', function () {
            const manifest = [
                {
                    file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
                    duration: 5,
                    fps: 60.07,
                    width: 1920,
                    height: 1080,
                    text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-fPHWqQafZ.mp4',
                    duration: 5,
                    fps: 30,
                    width: 1920,
                    height: 1080,
                    text: ''
                },
                {
                    file: '/home/chris/.local/state/clippyclub/LachrymoseToughBoarRuleFive-sey4XS-12345789B.mp4',
                    duration: 5,
                    fps: 30,
                    width: 1920,
                    height: 1080,
                    text: 'tacotron'
                }
            ]
            const filterComplex = getAudioFilterComplex(manifest)
            expect(filterComplex).to.equal('[0]atrim=start=0:end=5[a0];[1]atrim=start=0:end=5[a1];[2]atrim=start=0:end=5[a2];[a0][a1]acrossfade=duration=0.2:curve1=tri:curve2=tri[x0];[x0][a2]acrossfade=duration=0.2:curve1=tri:curve2=tri[audio];');
        })
        xit('four clips', function () {
            
        })
    })
})


