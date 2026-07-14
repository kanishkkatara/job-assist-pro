let audioContext: AudioContext;
let transcriberWorker: Worker;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === "process_stream") {
    try {
      const streamId = message.streamId;
      
      // 1. Get the actual MediaStream using the streamId
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        } as unknown as boolean, // TypeScript workaround for chrome-specific constraint
        video: false
      });

      // Whisper-tiny.en expects 16kHz
      audioContext = new AudioContext({ sampleRate: 16000 }); 
      const source = audioContext.createMediaStreamSource(stream);
      
      // 2. Play audio back to user (prevents muting the meeting!)
      source.connect(audioContext.destination);

      // 3. Process audio for transcription
      // ScriptProcessor is deprecated but easiest for raw PCM extraction in MV3
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      // Initialize Web Worker for WASM Inference
      transcriberWorker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Send raw float32 PCM chunks to the WASM worker
        // We clone it because it's detached when passed
        transcriberWorker.postMessage({
          action: "audio_chunk",
          data: new Float32Array(inputData)
        });
      };
      
      transcriberWorker.onmessage = (e) => {
          if (e.data.status === 'transcription') {
              // Send transcript back to UI or Background
              chrome.runtime.sendMessage({ 
                  type: 'COPILOT_TRANSCRIPT', 
                  text: e.data.text 
              });
          }
      };

      console.log("[JobAssist Offscreen] Audio pipeline started.");

    } catch (e) {
      console.error("[JobAssist Offscreen] Failed to start audio pipeline", e);
    }
  }
});
