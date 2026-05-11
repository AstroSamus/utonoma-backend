import express from 'express'

const router = express.Router()

router.get('/test', (req, res) => {
    res.send('server is running fine')
})

export default router