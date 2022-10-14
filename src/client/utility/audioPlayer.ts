import scuttle from "@/client/assets/audio/scuttle.mp3";
import click from "@/client/assets/audio/click.mp3";

export const enum SoundEffect {
    TileDropping,
    TileSliding,
    InvalidAction,
    GameStarted,
    GameEnded,
    TimeAlert,
    GeneralAlert
}

const sfxToUrl = [
    click,
    scuttle
    // TODO add sounds here in order of SoundEffect entries
] as const;

const defaultGain = 0.3; // TODO set this to something sensible

/**
 * Simple utility class to load & play sound effects on demand. Implemented using Web
 * Audio API, documentation for which is linked. 
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API}
 */
export default abstract class AudioPlayer {
    private static audioContext: AudioContext;
    private static initialized = false;

    private static audioBuffers: AudioBuffer[] = [];
    private static gain: GainNode;

    /**
     * Asynchronously initialize by fetching all sound effect files, and creating and
     * connecting a gain node for volume-controlled playback.
     * 
     * @param callback optional callback to call once initialized
     * @param callbackAt trigger callback early when this sound is ready to play
     */
    public static init(callback?: () => void, callbackAt?: SoundEffect): void {
        this.initialized = true;
        this.audioContext = new AudioContext();

        this.gain = this.audioContext.createGain();
        this.gain.gain.value = defaultGain;
        this.gain.connect(this.audioContext.destination); // final node in graph

        this.loadBuffers(sfxToUrl, this.audioBuffers, callback, callbackAt);
    }

    /**
     * Play given sound effect at given volume, automatically initializing if needed.
     * Note that "An AudioBufferSourceNode can only be played once;"
     * 
     * @param sound the sound effect to play
     * @param volume optional value to which to set audio gain before playing sound
     */
    public static play(sound: SoundEffect, volume?: number): void {
        if (!this.initialized) {
            console.warn("Automatically initializing before playing sound.");
            this.init(() => this.play(sound, volume), sound);
            return;
        }
        if (sound >= this.audioBuffers.length || !this.audioBuffers[sound]) {
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
     * @param callback optional callback to call once loaded
     * @param callbackAt trigger callback early when this buffer (vs. all buffers) is loaded
     */
    private static loadBuffers(
        urls: readonly string[],
        buffers: AudioBuffer[],
        callback?: () => void,
        callbackAt?: SoundEffect
    ): void {
        let totalLoaded = 0;
        urls.forEach((url, index) => {
            fetch(url)
                .then(response => response.arrayBuffer())
                .then(arrayBuf => this.audioContext.decodeAudioData(arrayBuf))
                .then(audioBuf => {
                    buffers[index] = audioBuf; // cannot .push() as buffers can load out of order
                    totalLoaded++;
                    if (callback) {
                        if (callbackAt === index) callback();
                        else if (totalLoaded === urls.length) callback();
                    }
                })
                .catch(err => console.error("Error fetching or decoding audio file:", err));
        });
    }
}