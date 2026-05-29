import { spawn } from 'child_process'
import { 
  GetActualVideoInfoResult, 
  CodecInfo
 } from '../types.js'
import { logger } from '../infrastructure/logger.js'

const ALLOWED_VIDEO_CODECS = new Set([
  'h264',
  'hevc',
  'vp8',
  'vp9',
  'av1',
])

const ALLOWED_FORMATS = new Set([
  'mov,mp4,m4a,3gp,3g2,mj2',
  'matroska,webm',
])

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska'
])

function getActualVideoInfo(filePath: string): Promise<GetActualVideoInfoResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name,codec_type',
      '-show_entries', 'format=format_name,duration',
      '-of', 'json',
      filePath,
    ]

    const ffprobe = spawn('ffprobe', args)

    let stdout = ''
    let stderr = ''

    ffprobe.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    ffprobe.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ffprobe.on('error', (err) => {
      reject(err)
    })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe exited with code ${code}: ${stderr}`)
        )
      }

      try {
        const json = JSON.parse(stdout)

        const stream = json.streams?.[0]
        const format = json.format ?? {}

        if (!stream) {
          return reject(new Error('No video stream found in file'))
        }

        const width = Number(stream.width ?? 0)
        const height = Number(stream.height ?? 0)
        const duration = format.duration ? Number(format.duration) : 0
        const codecName = stream.codec_name ?? null
        const codecType: string | null = stream.codec_type ?? null;
        const formatName: string | null = format.format_name ?? null;

        if (!width || !height) {
          return reject(new Error('Invalid video resolution from ffprobe'))
        }

        resolve({
          width,
          height,
          duration,
          codecName,
          codecType,
          formatName,
          isValid: isValidVideo({ 
            codecName, 
            codecType, 
            formatName 
          }),
          isWebM: formatName?.toLowerCase().includes('webm') || false
        })
      } catch (err) {
        reject(err)
      }
    })
  })
} 

function convertToWebM(
  inputPath: string,
  outputPath: string,
  progressCallback?: (progress: string) => void
): Promise<[Error | null, boolean]> {
  return new Promise((resolve) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '0',
      '-row-mt', '1',
      '-threads', '4',
      '-c:a', 'libopus',
      outputPath
      // do not forget to include the file extension on the output path
    ] 

    const ffmpeg = spawn('ffmpeg', args)

    ffmpeg.on('error', (err) => {
      resolve([new Error(`ffmpeg error: ${err.message}`), false])
    })
    
    if(progressCallback) {
      ffmpeg.stderr.on('data', data => {
        const dataStr = data.toString()
        const time = dataStr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)?.[1] || null
        if(time) progressCallback(time)
      }) 
    }

    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve([null, true]);
      } else {
        resolve([new Error(`ffmpeg exited with code ${code}`), false]);
      }
    })
  })
}

function isValidVideo( metadata: CodecInfo ) : boolean {
  if(!metadata?.codecType || metadata.codecType !== 'video') {
    logger.info(`Stream codec_type is not video: ${metadata?.codecType}`)
    return false
  }

  if(!metadata.codecName) {
    logger.info('Missing codec_name in ffprobe output')
    return false
  }

  if(!metadata.formatName) {
    logger.info('Missing format name in ffprobe output')
    return false
  }

  if(!ALLOWED_VIDEO_CODECS.has(metadata?.codecName)) {
    logger.info(`Unsupported video codec: ${metadata.codecName}`)
    return false
  }

  if(!ALLOWED_FORMATS.has(metadata?.formatName)) {
    logger.info(`Unsupported container format: ${metadata?.formatName}`)
    return false
  }

  return true
}

function isValidVideoMimeType(mimeType: string) : boolean {
  if(ALLOWED_VIDEO_TYPES.has(mimeType)) return true
  return false
}

export const videoUtils = {
  isValidVideoMimeType,
  getActualVideoInfo,
  convertToWebM,
}