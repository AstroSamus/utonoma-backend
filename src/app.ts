import express from 'express'
import uploadContentRoutes from './routes/uploadContent.routes'

const app = express()

app.use(express.json())

app.use('/upload-content', uploadContentRoutes)

export default app