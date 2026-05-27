import express from 'express'
import cors from 'cors';
import uploadContentRoutes from './routes/uploadContent.routes.js'

const app = express()


app.use(cors())
app.use(express.json())



app.use('/upload-content', uploadContentRoutes)

export default app