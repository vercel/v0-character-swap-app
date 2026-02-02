// Web Worker for processing video with ffmpeg.wasm
// This runs in a separate thread to avoid blocking the main UI

let ffmpeg: any = null
let loaded = false

interface ProcessMessage {
  type: "process"
  blob: ArrayBuffer
  mimeType: string
}

interface ProgressMessage {
  type: "progress"
  stage: "loading" | "processing" | "done" | "error"
  percent: number
  message: string
}

interface ResultMessage {
  type: "result"
  blob: ArrayBuffer
}

interface ErrorMessage {
  type: "error"
  message: string
  originalBlob: ArrayBuffer
}

self.onmessage = async (e: MessageEvent<ProcessMessage>) => {
  if (e.data.type !== "process") return

  const { blob: inputBuffer, mimeType } = e.data

  try {
    // Send progress: loading
    postProgress("loading", 0, "Loading processor...")

    // Dynamically import ffmpeg.wasm
    const { FFmpeg } = await import("@ffmpeg/ffmpeg")
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util")

    // Initialize FFmpeg if not already loaded
    if (!ffmpeg) {
      ffmpeg = new FFmpeg()
    }

    if (!loaded) {
      postProgress("loading", 10, "Downloading ffmpeg...")

      // Load ffmpeg with CORS-enabled URLs
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm"

      ffmpeg.on("progress", ({ progress: p }: { progress: number }) => {
        const percent = Math.round(30 + p * 60) // 30-90% for processing
        postProgress("processing", percent, "Processing video...")
      })

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      })

      loaded = true
    }

    postProgress("processing", 25, "Preparing video...")

    // Determine input format
    const inputExt = mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("quicktime")
        ? "mov"
        : "webm"
    const inputFile = `input.${inputExt}`
    const outputFile = "output.mp4"

    // Write input file to ffmpeg's virtual filesystem
    const inputData = await fetchFile(new Blob([inputBuffer], { type: mimeType }))
    await ffmpeg.writeFile(inputFile, inputData)

    postProgress("processing", 30, "Re-encoding video...")

    // Run ffmpeg to re-encode with proper settings
    await ffmpeg.exec([
      "-i",
      inputFile,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-y",
      outputFile,
    ])

    postProgress("processing", 90, "Finalizing...")

    // Read the output file
    const outputData = await ffmpeg.readFile(outputFile)

    // Clean up files
    await ffmpeg.deleteFile(inputFile)
    await ffmpeg.deleteFile(outputFile)

    postProgress("done", 100, "Done!")

    // Send result back
    const resultMessage: ResultMessage = {
      type: "result",
      blob: (outputData as Uint8Array).buffer,
    }
    self.postMessage(resultMessage, [resultMessage.blob])
  } catch (error) {
    console.error("[ffmpeg worker] Error:", error)

    // Send error with original blob so caller can fall back
    const errorMessage: ErrorMessage = {
      type: "error",
      message: error instanceof Error ? error.message : "Processing failed",
      originalBlob: inputBuffer,
    }
    self.postMessage(errorMessage)
  }
}

function postProgress(stage: ProgressMessage["stage"], percent: number, message: string) {
  const progressMessage: ProgressMessage = {
    type: "progress",
    stage,
    percent,
    message,
  }
  self.postMessage(progressMessage)
}
