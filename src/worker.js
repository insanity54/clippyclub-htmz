import 'dotenv/config'
import Database from 'better-sqlite3'
import { dbPath, statePath } from './const.js'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import Download from './Download.js'
import { sub } from 'date-fns'
import { 
    NotEnoughClips,
    ChannelNotFound,
    RenderTitlesFailed,
    RenderVideoFailed,
    RenderAudioFailed,
    RenderCombineFailed,
    DownloadFailed,
} from './errors.js'
import { combine, getClipFilePath, getVideoProbe } from './video.js'


const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.TWITCH_CLIENT_ID) throw new Error('TWITCH_CLIENT_ID undefined in env');
if (!process.env.TWITCH_CLIENT_SECRET) throw new Error('TWITCH_CLIENT_SECRET undefined in env');

async function download(db, job) {

    console.log(`downloading channel=${job.channel} clips`)
    const now = new Date()
    const startDate = sub(now, { days: job.range }).toISOString()
    const endDate = now.toISOString()

    db
        .prepare("UPDATE compilations SET status = @status WHERE id = @id")
        .run({ id: job.id, status: 'downloading' });

    // @todo remove this if its ok
    // we are handling errors at higher level
    // try {
    console.log('let us DL')
    const dl = new Download(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET)
    console.log('let us user')
    const user = await dl.getTwitchUserObjectFromChannelName(job.channel)
    console.log(user)
    console.log('let us cips')
    const clips = await dl.getClips(user.id, startDate, endDate, job.count);
    console.log('let us selection')
    const selection = dl.selectClips(clips, job.count, job.method);
    console.log('let us downloadVideos')
    const manifest = await dl.downloadVideos({
        selection,
        endDate,
        startDate,
        twitchChannel: job.channel,
        count: job.count,
        user
    })
    // console.log('here is the manifest')
    // console.log(manifest)
    db.prepare(`UPDATE compilations SET manifest = @manifest WHERE id = @id`).run({ id: job.id, manifest: JSON.stringify(manifest) })
    // } catch (e) {
    //     console.log(`CAUGHT ${e}`)
    //     if (e instanceof NotEnoughClips) {
    //         db.prepare(`UPDATE compilations SET status = @status WHERE id = @id`).run({ id: job.id, status: 'LTMINCLIPS' })
    //     }
    //     if (e instanceof ChannelNotFound) {
    //         db.prepare(`UPDATE compilations SET status = @status WHERE id = @id`).run({ id: job.id, status: 'CHANNELNOTFOUND' })
    //     }
    // }

}

async function render(db, job) {
    console.log(`rendering ${job.channel} compilation`)
    // try {
        // const file = readFileSync(join(__dirname, '../assets/template.json'))
        // const spec = JSON.parse(file)

        
        const { manifest: data } = db.prepare(`SELECT manifest FROM compilations WHERE id = ?`).get(job.id);
        const twitchClipSpec = JSON.parse(data)
        
        db
            .prepare("UPDATE compilations SET status = @status WHERE id = @id")
            .run({ id: job.id, status: 'rendering' });


        // this uses editly which is SLOW
        // const outputFilePath = await combineClips ({
        //     directory: statePath,
        //     outputFileName: join(statePath, `compilation_${job.id}.mp4`),
        //     outro: null,
        //     manifest: data,
        //     fast: true
        // })

        // create compilation manifest
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

        let manifest = []
        for (const clip of twitchClipSpec) {
            const clipFile = getClipFilePath(clip.id)
            const probe = await getVideoProbe(clipFile)
            manifest.push({
                file: clipFile,
                duration: parseFloat(probe.duration),
                fps: parseFloat(probe.fps),
                width: probe.width,
                height: probe.height,
                text: `${clip.title}\nClipped by ${clip.creatorDisplayName}\n${clip.views} views`
            })
        }

        console.log('manifest is as follows')
        console.log(manifest)

        // this uses ffmpeg which is FASTer
        const outputFileName = getClipFilePath(`compilation_${job.id}`)



        // try {
        await combine(manifest, outputFileName)
        // } catch (e) {
        //     console.error('ERROR\nERROR\nERROR\n '+e)
        //     db
        //         .prepare("UPDATE compilations SET status = @status WHERE id = @id")
        //         .run({ id: job.id, status: 'error' });
        // }
        console.log(`outputFileName=${outputFileName}`)




    // } catch (e) {
    //     console.error('failed to createCompilation')
    //     console.error(e)
    // }
}

async function upload(db, job) {
    console.log(`uploading ${job.channel} compilation`);
    console.log(`@todo upload`)
    db.prepare(`UPDATE compilations SET status = @status WHERE id = @id`)
        .run({
            id: job.id,
            status: 'uploading'
        });
}


async function createCompilation(db, job) {
    await mkdir(statePath, { recursive: true })

    console.log('creatingCompilation. ')
    console.log(job)
    if (!job) throw new Error('job is missing')

    try {
        await download(db, job)
        await render(db, job)
        await upload(db, job)
    } catch (e) {
        console.log(`CAUGHT ${e}`)
        console.log(e.code)
        return db.prepare(`UPDATE compilations SET status = @status WHERE id = @id`).run({ id: job.id, status: e.code })
    }

}

async function main() {
    const db = new Database(dbPath)
    
    const pendingJobs = db.prepare(`SELECT * FROM compilations WHERE status = 'pending'`).all();

    // console.log('here are the pending jobs')
    // pendingJobs.forEach(job => {
    //     console.log(job)
    // });

    
    if (pendingJobs.length > 0) {
        // begin work
        console.info(`There are ${pendingJobs.length} pending jobs.`)
        await createCompilation(db, pendingJobs.at(0))
    }

    setTimeout(() => {
        // wait 1 second then look for more jobs
        return main()
    }, 1000)

}


main()