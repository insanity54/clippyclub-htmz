
import { ApiClient } from 'twitch'
import { ClientCredentialsAuthProvider } from 'twitch-auth'
import { DateTime } from "luxon"
import path from 'path'
import YTDlpWrap from 'yt-dlp-wrap';
import { mkdir, writeFile } from 'fs/promises'
import { NotEnoughClips } from './errors.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { statePath } from './const.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ytdl = new YTDlpWrap.default()


export default class Download {
  constructor (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET) {
    if (typeof TWITCH_CLIENT_ID === 'undefined') throw new Error('TWITCH_CLIENT_ID is undefined');
    if (typeof TWITCH_CLIENT_SECRET === 'undefined') throw new Error('TWITCH_CLIENT_SECRET is undefined');
    this.authProvider = new ClientCredentialsAuthProvider(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
    this.apiClient = new ApiClient({ authProvider: this.authProvider });
    this.downloadVideos = this.downloadVideos.bind(this);
  }



  /**
   * 
   * downloadVideo
   * 
   * @param {string} url
   * @param {string} downloadPath
   * @return {Promise}
   * @resolve {string} filename
   * 
   */
  async downloadVideo(url, downloadPath, tries = 0) {
    if (typeof url === 'undefined') throw new Error('url is undefined, but it must be defined');
    if (typeof url === 'object') throw new Error('url is an object but it must be a string')
    if (typeof downloadPath === 'undefined') throw new Error('downloadPath is undefined, but it must be defined');
    console.log(`Downloading ${url} to ${downloadPath}`);

    console.log(`  [*] Downloading video ${url}. Attempt number ${tries}`);

    const _dlActual = (url, downloadPath) => {

      return new Promise((resolve, reject) => {
        let completionPercentage = 0;
        const emitter = ytdl.exec(
          [url, "-o", downloadPath]
        );

        emitter.on("progress", (progress) => {
          completionPercentage = progress.percent
          // Check if progress is at one of the desired intervals
          const percent = Math.floor(completionPercentage)
          if (percent % 10 === 0 && percent !== 0) {
            console.log(`${percent}%`);
          }
        });

        emitter.on("youtubeDlEvent", (eventType, eventData) => console.log(`eventType:${eventType}, eventData:${eventData}`))

        emitter.on("error", (error) => {
          console.error("_dl error")
          console.error(error)
          reject(error);
        })

        emitter.on("close", () => {
          console.log(`_dl close with completionPercentage ${completionPercentage}`);
          if (completionPercentage !== 100) reject(`Video download did not reach 100% (only reached ${completionPercentage}%`);
          console.log(`  [r] resolving with ${downloadPath}`)
          resolve(downloadPath);
        });
      })
    }


    try {
      await _dlActual(url, downloadPath);
    } catch (e) {
      console.log(e);
      console.log('  [E] Download Error CAUGHT! Trying again.')
      if (tries > 25) {
        throw new Error('  [&] AYEO we tried 25 times and were not able to dl the file.')
      } else {
        const newtries = tries+1
        console.log(`  [n] tries:${tries} newtries:${newtries}`)
        return this.downloadVideo(url, downloadPath, newtries)
      }
    }

    return downloadPath

  }

  // use the twitch API to get a filtered list of clip urls
  async getClips (userId, startDate, endDate, count = 3) {

    console.info(`getClips() ${count} clips from channel ${userId} with startDate:${startDate} and endDate:${endDate}`);
    if (typeof userId === 'undefined') throw new Error('userId passed to getClips must be defined, but it was undefined');
    if (typeof startDate === 'undefined' || typeof endDate === 'undefined') throw new Error('{String} startDate and endDate must be supplied to getClips. one of them was undefined.');
    if (!endDate) throw new Error('endDate was missing');
    if (!count) throw new Error('count was missing');

    const filter = {
      startDate: DateTime.fromISO(startDate).toISO(),
      endDate: DateTime.fromISO(endDate).toISO()
    };

    console.log('lets call getClipsForBroadcasterPaginated')
    const result = this.apiClient.helix.clips.getClipsForBroadcasterPaginated(userId, filter);

    console.log('lets go through the results and get clipInfo')
    const res = [];
    for await (const video of result) {
      const clipInfo = {
        broadcasterDisplayName: video.broadcasterDisplayName,
        broadcasterId: video.broadcasterId,
        creationDate: video.creationDate,
        creatorDisplayName: video.creatorDisplayName,
        creatorId: video.creatorId,
        embedUrl: video.embedUrl,
        gameId: video.gameId,
        id: video.id,
        language: video.language,
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
        url: video.url,
        videoId: video.videoId,
        views: video.views
      };
      res.push(clipInfo);
    }

    console.info(`${userId} has ${res.length} clips during this time period.`);


    if (res.length < count) throw new NotEnoughClips(`There were not at least ${count} clips for Twitch user ${userId} between ${startDate} and ${endDate}`);

    return res;
  }


  selectClips (clips, count, method) {
    if (!clips) throw new Error('selectClips arg clips was missing');
    if (!method) throw new Error('selectClips arg method was missing');
    let selectedClips
    if (method === 'popular') {
      selectedClips = clips.sort((c) => c.views).slice(0, count);
    } else if (method === 'random') {
      // Shuffle the array randomly
      let shuffledClips = clips.slice(); // Create a shallow copy of the array
      for (let i = shuffledClips.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledClips[i], shuffledClips[j]] = [shuffledClips[j], shuffledClips[i]]; // Swap elements randomly
      }
      selectedClips = shuffledClips.slice(0, count); // Select the first `count` clips from the shuffled array
    }
    return selectedClips
  }



  async prepareDownloadPath (clipInfo) {
    const { id } = clipInfo;
    const fileName = `${id}.mp4`;
    const downloadPath = path.join(statePath, fileName);
    return downloadPath;
  }

  getManifestPath (broadcasterDisplayName, startDate, endDate) {
    const outputPath = this.getOutputPath(broadcasterDisplayName, startDate, endDate);
    return path.join(outputPath, 'clipInfo.json');
  }

  async writeManifestFile (clipInfo, manifestFilePath) {
    return writeFile(manifestFilePath, JSON.stringify(clipInfo, 0, 2), { data: 'utf-8' });
  }

  async getTwitchUserObjectFromChannelName (channelName) {
    const user = await this.apiClient.helix.users.getUserByName(channelName);
    if (!user) throw new ChannelNotFound();
    return user
  }

  async downloadVideos (args) {
    const { endDate, startDate, user, twitchChannel, count, selection } = args;
    
    const userData = user._data;
    console.info(JSON.stringify(userData));

    const { id, display_name: displayName } = userData;


    const clipFilePaths = [];
    for await (const clipInfo of selection) {
      const downloadPath = await this.prepareDownloadPath(clipInfo);
      await this.downloadVideo(clipInfo.url, downloadPath);
    }
    console.info(`Downloads complete.`);

    return selection

    // const manifestFilePath = this.getManifestPath(twitchChannel, startDate, endDate);
    // console.info(`writing manifest file to ${manifestFilePath}`);
    // await this.writeManifestFile(selection, manifestFilePath);
    // console.info(`manifest written to ${manifestFilePath}`);
    // return manifestFilePath;
  }
}





