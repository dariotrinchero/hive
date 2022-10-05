import dash from "@/client/assets/audio/dash.mp3";

export enum SoundEffect {
    TileDropping,
    TileSliding,
    InvalidAction,
    GameStarted,
    GameEnded,
    TimeAlert,
    GeneralAlert
}

const sfxToUrl = [
    dash
    // TODO add sounds here in order of SoundEffect entries
] as const;

const defaultGain = 0.7;

export default abstract class AudioPlayer {
    private static audioContext: AudioContext;
    private static initialized = false;

    private static audioBuffers: AudioBuffer[] = [];
    private static gain: GainNode;

    /**
     * Asynchronously initialize by fetching all sound effect files, and creating and
     * connecting a gain node for volume-controlled playback.
     * 
     * @param volume optional value to which to set audio gain
     * @param loaded optional callback to call once fully initialized
     */
    public static init(volume?: number, loaded?: () => void): void {
        this.initialized = true;
        this.audioContext = new AudioContext();

        this.gain = this.audioContext.createGain();
        this.gain.gain.value = volume || defaultGain;
        this.gain.connect(this.audioContext.destination); // final node in graph

        this.loadBuffers(sfxToUrl, this.audioBuffers, loaded);
    }

    /**
     * Play given sound effect at given volume. Automatically runs initialization if needed.
     * 
     * @param sound the sound effect to play
     * @param volume optional value to which to set audio gain before playing sound
     */
    public static play(sound: SoundEffect, volume?: number): void {
        if (!this.initialized) {
            console.warn("Automatically initializing before playing sound.");
            this.init(volume, () => this.play(sound, volume));
            return;
        }
        if (sound >= this.audioBuffers.length) {
            console.warn("Ignoring attempt to play sound not loaded by initialization.");
            return;
        }
        if (volume) this.gain.gain.value = volume;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffers[sound];
        source.connect(this.gain);
        source.start();
    }

    /**
     * Asynchronously load audio files from given list of URLs, appending resulting audio
     * buffers to given list.
     * 
     * @param urls list of URLs of audio files to load
     * @param buffers list of audio buffers to which to append retrieved files
     * @param loaded optional callback to call once all buffers are loaded
     */
    private static loadBuffers(
        urls: readonly string[],
        buffers: AudioBuffer[],
        loaded?: () => void
    ): void {
        for (const url of urls) {
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuf => this.audioContext.decodeAudioData(arrayBuf))
                .then(audioBuf => {
                    buffers.push(audioBuf);
                    if (buffers.length === urls.length && loaded) loaded();
                })
                .catch(err => console.error("Error fetching or decoding audio file:", err));
        }
    }
}