console.log('upload.js loaded')
const AWS = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const express = require('express')
const router = express.Router()
const { verifyToken } = require('./auth')

const s3 = new AWS.S3({ region: process.env.AWS_REGION })

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'mini-jira-images-originals',
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  })
})

router.post('/', verifyToken, upload.single('image'), (req, res) => {
  console.log('Upload hit!')
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ imageUrl: req.file.location, key: req.file.key })
})

module.exports = router