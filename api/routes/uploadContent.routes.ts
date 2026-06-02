import express from 'express'
import { 
  createUploadSession,
  subToProgressUpdates,
  uploadShortVideo,
  uploadShortVideoMetadata
} from '../controllers/uploadContent.controller.js'

const router = express.Router()

router.post('/create-upload-session', createUploadSession)
router.get('/:sessionId/progress-updates', subToProgressUpdates)
router.post('/:sessionId/upload-short-video', uploadShortVideo)
router.post('/:sessionId/upload-short-video-metadata', uploadShortVideoMetadata)

export default router