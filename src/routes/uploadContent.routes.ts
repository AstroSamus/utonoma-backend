import express from 'express'
import { createUploadSession } from '../controllers/uploadContent.controller'

const router = express.Router()

router.post('/create-upload-session', createUploadSession)

export default router