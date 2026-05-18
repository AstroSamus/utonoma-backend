import express from 'express'
import { 
  createUploadSession,
  subToProgressUpdates
} from '../controllers/uploadContent.controller'

const router = express.Router()

router.post('/create-upload-session', createUploadSession)
router.get('/:sessionId/progress-updates', subToProgressUpdates)

export default router