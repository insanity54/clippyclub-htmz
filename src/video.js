
import { execa } from 'execa'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import ffprobe from 'ffprobe'
import { statePath } from './const.js'
import { join, dirname } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { RenderAudioFailed, RenderCombineFailed, RenderTitlesFailed, RenderVideoFailed, RenderTitlesMergeFailed } from './errors.js'


const __dirname = dirname(fileURLToPath(import.meta.url));
const fontfile = join(__dirname, '../assets/PatuaOne-Regular.ttf')


export async function getVideoProbe(fileName) {
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

export function getClipFilePath(clipId) {
    if (!clipId) throw new Error('clipId passed to getClipFilePath was undefined')
    return join(statePath, `${clipId}.mp4`)
}

export function getTitleTextFilePath(clipId) {
    if (!clipId) throw new Error('clipId passed to getTitleTextFilePath was undefined')
    return join(statePath, `${clipId}_text.txt`)
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
async function createCompilationManifest(clipSpec) {
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

async function loadClipSpecFile(manifestFile) {
    const data = await readFile(manifestFile, { encooding: 'utf-8' });
    const json = JSON.parse(data)
    return json
}

async function addProbeDataToManifest(manifest) {
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



function generateXfades(manifest, xDur = 0.2, transition = 'diagtr') {
    const xfades = [];
    let offset = 0;

    for (let i = 0; i < manifest.length - 1; i++) {
        const clipDuration = manifest[i].duration;

        offset += (clipDuration - xDur);
        xfades.push({
            inputA: i === 0 ? 'v0' : `x${i - 1}`,
            inputB: `v${i + 1}`,
            transition: transition,
            duration: xDur,
            offset: parseFloat(offset).toFixed(2),
            output: i === manifest.length - 2 ? 'video' : `x${i}`
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
            output: i === manifest.length - 2 ? 'audio' : `x${i}`
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
    for (let i = 0; i < manifest.length; i++) {
        lines.push(`[${i}]atrim=start=0:end=${manifest[i].duration}[a${i}];`)
    }
    const afades = generateAfades(manifest);
    const filterComplex = generateAfadeString(afades)
    return lines.join('').concat(filterComplex);
}

export function getVideoFilterComplex(manifest) {
    let lines = []
    if (manifest.length === 1) throw new Error('this function is only useful for manifests with >=2 clips');
    // settb
    for (let i = 0; i < manifest.length; i++) {
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


export function getTitleVideoFilterComplex(manifest) {
    let lines = []
    // settb
    for (let i = 0; i < manifest.length; i++) {
        lines.push(`[${i}]settb=AVTB[v${i}];`)
    }
    const xfades = generateXfades(manifest, 1, 'fade');
    const filterComplex = generateXfadeString(xfades)
    return lines.join('').concat(filterComplex);
}



/**
 * 
 * returns true if all clips in the manifest have the same dimensions
 */
async function dimensionCheck(manifest) {
    if (!manifest) throw new Error('dimensionCheck did not receive compilation manifest.')
    // console.log(`dimensionCheck. manifest as follows.`)
    // console.log(manifest)
    let width = manifest.at(0).width
    let height = manifest.at(0).height
    for (const clip of manifest) {
        if (clip.width !== width) return false;
        if (clip.height !== height) return false;
    }
    return true
}

/**
 * 
 * The purpose of this function is to convert all the clips to the same dimension.
 * 
 * Firstly an output resolution is decided using majority rules.
 * If there is no majority (tie of unique resolutions count), the resolution of the first clip is used.
 */
async function dimensionFix(manifest) {
    console.log('📺📺📺📺📺📺📺📺📺📺📺 dimensionFix() has been called.')
    console.log('the following is the manifest')
    console.log(manifest)

    // * [
    // *   {
    // *     file: '/home/chris/.local/state/clippyclub/DoubtfulCutePlumPeteZaroll-l88G0wyESdSoVOAJ.mp4',
    // *     duration: 15,
    // *     fps: 60.07,
    // *     width: 1920,
    // *     height: 1080,
    // *     text: 'CLIP TITLE 2\nClipped by joinks on April 3, 2003\n4 views'
    // *   },
    // *   {
    // *     file: '/home/chris/Documents/clippyclub-htmz/assets/outro3.mp4',
    // *     duration: 8,
    // *     fps: 30,
    // *     width: 1920,
    // *     height: 1080,
    // *     text: ''
    // *   }
    // * ]

    const resolutionCounts = {};

    manifest.forEach(clip => {
        const resolution = `${clip.width}x${clip.height}`;
        resolutionCounts[resolution] = (resolutionCounts[resolution] || 0) + 1;
    });

    console.log('following is resolutionCounts')
    console.log(resolutionCounts)

    for (const resolution in resolutionCounts) {
        console.log(`Resolution: ${resolution}, Count: ${resolutionCounts[resolution]}`);
    }

    const mostPopularResolution = Object.keys(resolutionCounts).reduce((a, b) => resolutionCounts[a] > resolutionCounts[b] ? a : b);
    console.log(`The most popular resolution is: ${mostPopularResolution}`);

    throw new Error('@todo dimensionFix is not yet implemented (fixme)')

    // @todo 
    // get a list of all the unique dimension specifications in the manifest
    // find the count of each dimension 
    // the dimension most used (majority) is elected as the output dimension.
    // if there is no majority, the dimension of the first clip is used.

    // for each clip using a minority dimension,
    //   render a new video using the majority dimension




}

/**
 * 
 * @param {Object} manifest
 */
export async function combine(manifest, outputPath) {
    if (!manifest) throw new Error('combine did not receive a manifest.')
    if (!outputPath) throw new Error('combine did not recieve an outputPath.')

    // Detect and handle videos of differing width/height
    const allClipsHaveSameDimensions = await dimensionCheck(manifest)
    if (!allClipsHaveSameDimensions) {
        const manifestWithScales = dimensionFix(manifest)
        return combine(manifestWithScales, outputPath)
    }

    const timestamp = new Date().valueOf()
    const tmpVideoOutputPath = join(statePath, `${timestamp}_video.nut`)
    const tmpAudioOutputPath = join(statePath, `${timestamp}_audio.wav`)
    const tmpTitlesOutputPaths = manifest.map((c, i) => join(statePath, `${timestamp}_title${i}.nut`))
    const tmpAllTitlesOutputPath = join(statePath, `${timestamp}_titles.nut`)

    console.log(`video:${tmpVideoOutputPath}, audio:${tmpAudioOutputPath}`)


    console.log(manifest)


    try {
        console.log(`>> generate titles videos`)
        for (const [i, clip] of Object.entries(manifest)) {
            console.log(`following is the clip ${i}`)
            console.log(clip)
            const textFilePath = join(statePath, `${timestamp}_title${i}.txt`)
            await writeFile(textFilePath, clip.text, { encoding: 'utf8' })

            const filterGraph = [
                `color=color=0x00000000:size=${manifest.at(0).width}x${manifest.at(0).height}:rate=${manifest.at(0).fps},trim=0:${parseFloat(clip.duration).toFixed(2)}[transparency];`,
                `color=color=0x0000004D:size=${manifest.at(0).width}x${manifest.at(0).height}:rate=${manifest.at(0).fps},trim=0:${Math.min(6, clip.duration)}[black];`,
                '[transparency]split[transparency0][transparency1];',
                '[transparency0][black]',
                `overlay=y='if(gte(t,${parseFloat(clip.duration).toFixed(2)}),h,5*h/7)':`,
                'repeatlast=0:',
                'shortest=0,',
                `drawtext=textfile=${textFilePath}:`,
                `alpha='if(gte(t,${Math.min(6, clip.duration)}),0,0.8)':`,
                'fontcolor=white:',
                'fontsize=h/18:',
                `fontfile=${fontfile}:`,
                'y=h-h/18-th:',
                "x='if(gte(t,3),h/18,h/18*(1-pow(1-t/3,4)))',",
                `trim=0:${parseFloat(clip.duration).toFixed(2)}[title];`,
                '[transparency1][title]xfade=transition=fade:duration=1[video];',
            ]
            await execa('ffmpeg', [
                '-filter_complex', filterGraph.join(''),
                '-map', '[video]',
                '-c:v', 'ffv1',
                '-fps_mode:1', 'cfr',
                '-pix_fmt', 'yuva420p',
                tmpTitlesOutputPaths[i]
            ])
            console.log(`>> written to ${tmpTitlesOutputPaths[i]}`)
        }


    } catch (e) {
        throw new RenderTitlesFailed(e)
    }


    console.log('>> merge together the individual title clips')
    try {
        let titleClipsManifest = []
        for (const [i, clip] of Object.entries(manifest)) {
            titleClipsManifest.push({
                duration: clip.duration,
                width: clip.width,
                height: clip.height,
                text: '',
                file: tmpTitlesOutputPaths[i]
            })
        }
        await execa('ffmpeg', [
            // '-r', '60',
            ...titleClipsManifest.flatMap((c) => ['-i', c.file]),
            '-filter_complex', getVideoFilterComplex(titleClipsManifest),
            '-fps_mode:1', 'cfr', // we set video output stream 1 to keep framerate constant so later we can merge audio in-sync
            '-pix_fmt', 'yuva420p',
            '-c:v', 'ffv1',
            '-map', '[video]',
            tmpAllTitlesOutputPath
        ])
    } catch (e) {
        throw new RenderTitlesMergeFailed(e)
    }


    // generate video
    // @reference https://romander.github.io/ffmpeg-script-generator/ 
    console.log(`>> generate clips video`)
    try {
        await execa('ffmpeg', [
            // '-r', '60',
            ...manifest.flatMap((c) => ['-i', c.file]),
            '-filter_complex', getVideoFilterComplex(manifest),
            '-fps_mode:1', 'cfr', // we set video output stream 1 to keep framerate constant so later we can merge audio in-sync
            '-pix_fmt', 'yuv420p',
            '-map', '[video]',
            tmpVideoOutputPath
        ])
        // ], { stdio: 'inherit' })
    } catch (e) {
        throw new RenderVideoFailed(e)
    }




    // generate audio
    try {
        console.log(`>> generate audio`)
        await execa('ffmpeg', [
            ...manifest.flatMap((c) => ['-i', c.file]),
            '-filter_complex', getAudioFilterComplex(manifest),
            '-fps_mode:1', 'cfr', // keep framerate constant so we can merge audio + video in-sync
            '-map', '[audio]',
            tmpAudioOutputPath
        ])
        // , {stdio: 'inherit' })
    } catch (e) {
        throw new RenderAudioFailed(e)
    }

    try {
        // merge video and audio
        console.log(`>> merge video with titles with audio`)
        await execa('ffmpeg', [
            '-y',
            '-i', tmpVideoOutputPath,
            '-i', tmpAllTitlesOutputPath,
            '-i', tmpAudioOutputPath,
            '-filter_complex', '[0:v][1:v]overlay[vid];',
            '-map', '[vid]',
            '-map', '2:a',
            '-c:v', 'libx264',
            '-c:a', 'aac',
            outputPath
        ])
        // , {stdio: 'inherit' })


    } catch (e) {
        throw new RenderCombineFailed(e)
    }

    console.log(`>> done. ${outputPath}`)

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

