import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let ffmpegLoading = false
let ffmpegLoaded = false

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpeg) {
    return ffmpeg
  }
  
  if (ffmpegLoading) {
    // Wait for existing load to complete
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (ffmpegLoaded && ffmpeg) {
      return ffmpeg
    }
  }
  
  ffmpegLoading = true
  
  try {
    ffmpeg = new FFmpeg()
    
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd'
    
    ffmpeg.on('log', ({ message }) => {
      console.log('[v0] FFmpeg:', message)
    })
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    
    ffmpegLoaded = true
    console.log('[v0] FFmpeg loaded successfully')
    return ffmpeg
  } catch (error) {
    console.error('[v0] Failed to load FFmpeg:', error)
    throw error
  } finally {
    ffmpegLoading = false
  }
}

export async function convertWebMToMP4(webmBlob: Blob): Promise<Blob> {
  // If already MP4, return as-is
  if (webmBlob.type.includes('mp4')) {
    console.log('[v0] Video is already MP4, skipping conversion')
    return webmBlob
  }
  
  console.log('[v0] Starting WebM to MP4 conversion, input size:', webmBlob.size)
  const startTime = Date.now()
  
  const ffmpeg = await loadFFmpeg()
  
  // Write input file
  const inputData = await fetchFile(webmBlob)
  await ffmpeg.writeFile('input.webm', inputData)
  
  // Convert to MP4 with H.264 codec
  // Using settings optimized for compatibility with Kling AI
  await ffmpeg.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',      // H.264 video codec
    '-preset', 'fast',       // Fast encoding
    '-crf', '23',            // Quality (lower = better, 23 is default)
    '-c:a', 'aac',           // AAC audio codec
    '-b:a', '128k',          // Audio bitrate
    '-movflags', '+faststart', // Optimize for web streaming
    '-pix_fmt', 'yuv420p',   // Pixel format for compatibility
    'output.mp4'
  ])
  
  // Read output file
  const outputData = await ffmpeg.readFile('output.mp4')
  const mp4Blob = new Blob([outputData], { type: 'video/mp4' })
  
  // Cleanup
  await ffmpeg.deleteFile('input.webm')
  await ffmpeg.deleteFile('output.mp4')
  
  const conversionTime = Date.now() - startTime
  console.log(`[v0] Conversion complete in ${conversionTime}ms, output size: ${mp4Blob.size}`)
  
  return mp4Blob
}

export function isFFmpegSupported(): boolean {
  // Check for SharedArrayBuffer support (required for ffmpeg.wasm)
  return typeof SharedArrayBuffer !== 'undefined'
}
