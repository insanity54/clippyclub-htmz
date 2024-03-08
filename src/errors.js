
export class NotEnoughClips extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotEnoughClips';
        this.code = 'LTMINCLIPS';
    }
}

export class ChannelNotFound extends Error {
    constructor(message) {
        super(message);
        this.name = 'ChannelNotFound';
        this.code = 'CHANNELNOTFOUND';
    }
}


export class RenderTitlesFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'RenderTitlesFailed';
        this.code = 'RENDERTITLESFAILED';
    }
}

export class RenderTitlesMergeFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'RenderTitlesMergeFailed';
        this.code = 'RENDERTITLESMERGEFAILED';
    }
}

export class RenderVideoFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'RenderVideoFailed';
        this.code = 'RENDERVIDEOFAILED';
    }
}


export class RenderAudioFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'RenderAudioFailed';
        this.code = 'RENDERAUDIOFAILED';
    }
}


export class RenderCombineFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'RenderCombineFailed';
        this.code = 'RENDERCOMBINEFAILED';
    }
}


export class DownloadFailed extends Error {
    constructor(message) {
        super(message);
        this.name = 'DownloadFailed';
        this.code = 'DOWNLOADFAILED';
    }
}
