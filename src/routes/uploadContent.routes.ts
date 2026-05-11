import express from 'express'
import { createUploadSesion } from '../controllers/uploadContent.controller'

const router = express.Router()

router.post('/create-upload-sesion', createUploadSesion)

export default router