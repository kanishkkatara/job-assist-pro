import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are in a browser extension context
env.allowLocalModels = false;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance: any = null;

    static async getInstance(progress_callback?: any) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task as any, this.model, { progress_callback: progress_callback as any });
        }
        return this.instance;
    }
}

let audioBuffer: Float32Array[] = [];
let isProcessing = false;
let totalSamples = 0;

self.addEventListener('message', async (event) => {
    if (event.data.action === "audio_chunk") {
        const chunk: Float32Array = event.data.data;
        audioBuffer.push(chunk);
        totalSamples += chunk.length;

        // Process every ~3 seconds of audio (16000 * 3 = 48000 samples)
        if (totalSamples >= 48000 && !isProcessing) {
            isProcessing = true;

            // Flatten buffer
            const mergedBuffer = new Float32Array(totalSamples);
            let offset = 0;
            for (const b of audioBuffer) {
                mergedBuffer.set(b, offset);
                offset += b.length;
            }

            // Clear buffer immediately for next chunks
            audioBuffer = [];
            totalSamples = 0;

            try {
                const transcriber = await PipelineSingleton.getInstance((x: any) => {
                    self.postMessage({ status: 'progress', data: x });
                });

                // Run inference
                const output = await transcriber(mergedBuffer);
                
                self.postMessage({ 
                    status: 'transcription', 
                    text: output.text 
                });
            } catch (err) {
                console.error("[Whisper Worker] Error during inference:", err);
            } finally {
                isProcessing = false;
            }
        }
    }
});
