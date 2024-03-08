
import { DateTime } from "luxon"
import YTDlpWrap from 'yt-dlp-wrap'
import { promises as fsp } from 'fs'
import { join, dirname, resolve } from 'path'
import editly from 'editly'
import ffprobe from 'ffprobe'
import { fileURLToPath } from 'url'
import { statePath } from './const.js'


const ytdl = new YTDlpWrap.default()
const __dirname = dirname(fileURLToPath(import.meta.url));




export function getOutroClipSpecification(outroVideoFilePath) {
  const outroClipSpecification = {
    layers: [
      {
        type: 'video',
        path: outroVideoFilePath || join(__dirname, '..', 'assets', 'outro3.mp4')
      }
    ]
  }
  return outroClipSpecification
}

export function getEditlySpec(fileNames, fps, width, height, clips, outputFileName, fast = false) {
  let spec = {
    defaults: {
      layer: {
        fontPath: resolve(__dirname, '..', 'assets', 'PatuaOne-Regular.ttf')
      },
      layerType: {
        'fill-color': {
          color: '#ff66cc',
        }
      },
      transition: {
        duration: 0.2,
        name: 'directionalwipe'
      },
    },
    width,
    height,
    fps,
    keepSourceAudio: true,
    outPath: outputFileName,
    allowRemoteRequests: false,
    clips,
    // audioNorm: { enable: true, gaussSize: 91, maxGain: 100 }, // doesn't have an effect because we only have one audio stream at a time (editly limitation)
    verbose: false,
    fast // use this for testing
  }
  return spec
}

export function configureEditlyLayer(clipDuration, clipInfo, fileName) {
  // see https://github.com/mifi/editly/tree/master/examples for reference
  const { creationDate, creatorDisplayName, title, views } = clipInfo;

  if (typeof clipDuration === 'undefined') {
    const msg = `the duration of ${fileName} must be >0, but it is undefined.`
    console.error(msg)
    throw new Error(msg)
  }

  console.info(`the duration is ${clipDuration}`);
  return {
    layers: [
      {
        type: 'video',
        path: fileName
      },
      {
        start: 0,
        stop: (clipDuration < 6) ? clipDuration : 6,
        type: 'subtitle',
        text: `${title} \nClipped by ${creatorDisplayName} on ${DateTime.fromISO(creationDate).toLocaleString(DateTime.DATE_FULL)}\n${views} views`,
      },
    ]
  }
}

export function getClipAbsoluteFileName(directory, clipId) {
  if (typeof directory === 'undefined') throw new Error('missing directory param');
  if (typeof clipId === 'undefined') throw new Error('missing clipId param!');

  let absDir;
  if (directory[0] === '.') {
    // handle relative path
    absDir = join(process.env.PWD, directory, clipId + '.mp4')
  } else {
    // handle absolute path
    absDir = join(directory, clipId + '.mp4')
  }

  return absDir

}



export async function getVideoProbe(fileName) {
  console.log(`  [*] getVideoProbe ${fileName}`)
  let info = await ffprobe(fileName, { path: 'ffprobe' })
  let videoStream = info.streams.find((s) => s.codec_type === 'video')
  let juice = {
    fps: videoStream.r_frame_rate.split('/')[0],
    width: videoStream.width,
    height: videoStream.height,
    duration: videoStream.duration
  };
  return juice
}


export async function combineClips(argv) {
  const { directory, outputFileName, outro, manifest, fast } = argv;

  if (typeof outputFileName === 'undefined') throw new Error('combineClips must have param.outputFileName but it was undefined')
  // const manifest = require(manifestFile).slice(0, 2); // only use 2 videos (for testing)
  const relativeFileNames = manifest.map((m) => `${m.id}.mp4`);
  const fileNames = relativeFileNames.map((rfn) => resolve(directory, rfn));


  // Check to see if the video has already been generated.
  // To do this, we fs.stat outputFileName to see if the file exists
  // if the file exists, we skip generating a new video and simply return the filename.
  try {
    const stats = await fsp.stat(outputFileName);

    if (stats.birthtime) {
      console.info(`The video file ${outputFileName} already exists so I am refusing to combineClips`)
      return outputFileName;
    }

  } catch (e) {
    // get the video size & framerate
    let probe = await getVideoProbe(fileNames[0]);
    let { fps, width, height } = probe;

    // create a editly specification
    let clipsSpecification = [];
    for (const clipInfo of manifest) {
      let clipFileName = getClipAbsoluteFileName(directory, clipInfo.id)
      console.log(`${clipFileName}`)
      let { duration } = await getVideoProbe(clipFileName);
      console.info(`clipFileName=${clipFileName}, duration:${duration}`);
      let layer = configureEditlyLayer(duration, clipInfo, clipFileName)
      clipsSpecification.push(layer);
    };
    clipsSpecification.push(getOutroClipSpecification(outro));

    let videoParams = getEditlySpec(fileNames, fps, width, height, clipsSpecification, outputFileName, fast);
    console.log('following is videoParam')
    console.log(JSON.stringify(videoParams, null, 2))

    // use editly to generate the combined video
    await editly(videoParams);
    return outputFileName
  }
}
