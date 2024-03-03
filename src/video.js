
import { execa } from 'execa'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import ffprobe from 'ffprobe'
import { statePath } from './const.js'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { tmpdir } from 'os'




export async function getVideoProbe (fileName) {
    let info = await ffprobe(fileName, { path: 'ffprobe' })
    let videoStream = info.streams.find((s) => s.codec_type === 'video')
    let output = {
      fps: videoStream.r_frame_rate.split('/')[0],
      width: videoStream.width,
      height: videoStream.height,
      duration: videoStream.duration
    };
    return output
  }

export function getClipFilePath (clipId) {
    return join(statePath, `${clipId}.mp4`)
}

/**
 * We take a clip spec file (twitch clips info)
 * and get data about each individual clip using ffprobe
 * finally we build a compilationManifest file describing the entire compilation
 * 
 *  * compilation manifest example
 * 
 * [
 *   {
 *     file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
 *     duration: 15,
 *     fps: 60.07,
 *     width: 1920,
 *     height: 1080,
 *     text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
 *   },
 *   {
 *     file: '/home/chris/Documents/clippyclub-htmz/assets/outro3.mp4',
 *     duration: 8,
 *     fps: 30,
 *     width: 1920,
 *     height: 1080,
 *     text: ''
 *   }
 * ]
 */
async function createCompilationManifest (clipSpec) {
    let compilationManifest = []
    for (const clip of clipSpec) {
        const probe = await getVideoProbe(getClipFilePath(clip.id));
        compilationManifest.push({
            file: getClipFilePath(clip.id),
            text: `${clip.title}\nClipped by ${clip.creatorDisplayName}\n${clip.views} views`,
            width: parseInt(probe.width),
            height: parseInt(probe.height),
            duration: parseFloat(probe.duration),
            fps: parseFloat(probe.fps)
        })
    }
    // compilationManifest.push({
    //     file: join(__dirname, '../assets/outro3.mp4'),
    //     text: '',
    //     width: 1920,
    //     height: 1080,
    //     duration: 9.51,
    //     fps: 30
    // })
    return compilationManifest
}

async function loadClipSpecFile (manifestFile) {
    const data = await readFile(manifestFile, { encooding: 'utf-8' });
    const json = JSON.parse(data)
    return json
}

async function addProbeDataToManifest (manifest) {
    // get duration of clips
    let manifestWithProbeData = []
    for (const clip of manifest) {
        const probe = await getVideoProbe(getClipFilePath(clip.id))
        const mergedClipSpec = {
            ...clip,
            ...probe
        }
        manifestWithProbeData.push(mergedClipSpec)
    }

    return manifestWithProbeData
}



function generateXfades(manifest, xDur = 0.2) {
    const xfades = [];
    let offset = 0;

    for (let i = 0; i < manifest.length - 1; i++) {
        const clipDuration = manifest[i].duration;
        
        offset += (clipDuration - xDur);
        xfades.push({
            inputA: i === 0 ? 'v0' : `x${i - 1}`,
            inputB: `v${i + 1}`,
            transition: 'diagtr',
            duration: xDur,
            offset: parseFloat(offset).toFixed(2),
            output: i === manifest.length-2 ? 'video' : `x${i}`
        });
    }

    return xfades;
}

function generateAfades(manifest, aDur = 0.2) {
    const afades = [];
    let offset = 0;

    for (let i = 0; i < manifest.length - 1; i++) {
        const clipDuration = manifest[i].duration;
        
        offset += (clipDuration - aDur);
        afades.push({
            inputA: i === 0 ? 'a0' : `x${i - 1}`,
            inputB: `a${i + 1}`,
            curve1: 'tri',
            curve2: 'tri',
            duration: aDur,
            offset: parseFloat(offset).toFixed(2),
            output: i === manifest.length-2 ? 'audio' : `x${i}`
        });
    }

    return afades;
}



function generateXfadeString(xfades) {
    return xfades.reduce((acc, curr, index) => {
        const { inputA, inputB, transition, duration, offset, output } = curr;
        const xfade = `[${inputA}][${inputB}]xfade=transition=${transition}:duration=${duration}:offset=${offset}[${output}];`;
        return acc + xfade;
    }, '');
}

function generateAfadeString(afades) {
    return afades.reduce((acc, curr, index) => {
        const { inputA, inputB, duration, curve1, curve2, output } = curr;
        const afade = `[${inputA}][${inputB}]acrossfade=duration=${duration}:curve1=${curve1}:curve2=${curve2}[${output}];`;
        return acc + afade;
    }, '');
}

export function getAudioFilterComplex(manifest) {
    let lines = []
    // atrim
    for (let i = 0; i<manifest.length; i++) {
        lines.push(`[${i}]atrim=start=0:end=${manifest[i].duration}[a${i}];`)
    }
    const afades = generateAfades(manifest);
    const filterComplex = generateAfadeString(afades)
    return lines.join('').concat(filterComplex);
}

export function getVideoFilterComplex(manifest) {

    let lines = []

    // settb
    for (let i = 0; i<manifest.length; i++) {
        lines.push(`[${i}]settb=AVTB[v${i}];`)
    }

    const xfades = generateXfades(manifest);

    const filterComplex = generateXfadeString(xfades)


    return lines.join('').concat(filterComplex);


    // [0] --> [v0] \
    // [1] --> [v1] ---> [w0] \
    // [2] --> [v2] ---> [v2] ---> [video]

    // [v0][v1] --> [w0]
    // [w0][v2] --> [output]


    // here's output for 2 files
    // return `
    //     [0]settb=AVTB[v0];
    //     [1]settb=AVTB[v1];
    //     [v0][v1]xfade[output];
    // `

    // here's the output for 3 files
    // return `
    //     [0]settb=AVTB[v0];
    //     [1]settb=AVTB[v1];
    //     [2]settb=AVTB[v2];
    //     [v0][v1]xfade[w0];
    //     [w0][v2]xfade[video];
    // `


    // here's the output for 4 files
    // return `
    //     [0]settb=AVTB[v0];
    //     [1]settb=AVTB[v1];
    //     [2]settb=AVTB[v2];
    //     [3]settb=AVTB[v3];
    //     [v0][v1]xfade[w0];
    //     [w0][v2]xfade[w1];
    //     [w1][v3]xfade[video];
    // `

}




/**
 * 
 * @param {Object} manifest
 */
export async function combine(manifest, outputPath) {

    const timestamp = new Date().valueOf()
    const tmpVideoOutputPath = join(tmpdir(), `${timestamp}.mp4`)
    const tmpAudioOutputPath = join(tmpdir(), `${timestamp}.wav`)

    console.log(`video:${tmpVideoOutputPath}, audio:${tmpAudioOutputPath}`)

    console.log(manifest)
    // generate video
    // @reference https://romander.github.io/ffmpeg-script-generator/ 
    console.log(`>> generate video`)
    await execa('ffmpeg', [
        // '-r', '60',
        ...manifest.flatMap((c) => ['-i', c.file]),
        '-filter_complex', getVideoFilterComplex(manifest),
        '-fps_mode:1', 'cfr', // we set video output stream 1 to keep framerate constant so later we can merge audio in-sync
        '-pix_fmt', 'yuv420p',
        '-b:v', '1M', // @todo just for testing, we use a low bitrate to keep the encode faster. in prod we must remove 
        '-map', '[video]',
        tmpVideoOutputPath
    ])
    // ], { stdio: 'inherit' })


    // generate audio
    console.log(`>> generate audio`)
    await execa('ffmpeg', [
        ...manifest.flatMap((c) => ['-i', c.file]),
        '-filter_complex', getAudioFilterComplex(manifest),
        '-fps_mode:1', 'cfr', // keep framerate constant so we can merge audio + video in-sync
        '-map', '[audio]',
        tmpAudioOutputPath
    ], {stdio: 'inherit' })

    // merge video and audio
    console.log(`>> merge video with audio`)
    await execa('ffmpeg', [
        '-i', tmpVideoOutputPath,
        '-i', tmpAudioOutputPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        outputPath
    ])
    // ], {stdio: 'inherit' })
}


async function cli(clipSpecFile) {

    const outputPath = 'output.mp4'
    const clipSpec = await loadClipSpecFile(clipSpecFile)
    const manifest = await createCompilationManifest(clipSpec)
    await combine(manifest, outputPath)

}

if (hideBin(process.argv).length > 0) {
    const args = yargs(hideBin(process.argv))
        .command('combine <clipSpecFile>', 'combine video files together using smooth animations')
        .demandCommand(1)
        .parse()


    cli(args.clipSpecFile)
}

