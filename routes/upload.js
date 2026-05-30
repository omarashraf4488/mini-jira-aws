console.log('upload.js loaded')
const AWS = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const express = require('express')
const router = express.Router()
const { verifyToken } = require('./auth')

const s3 = new AWS.S3({ region: process.env.AWS_REGION })

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'mini-jira-images-originals',
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP)'), false)
    }
    cb(null, true)
  }
})

router.post('/', verifyToken, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB' })
      }
      return res.status(400).json({ error: err.message })
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    res.json({ imageUrl: req.file.location, key: req.file.key })
  })
})

module.exports = router