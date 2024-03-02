
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
