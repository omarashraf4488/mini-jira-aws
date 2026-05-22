const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { verifyToken } = require('./auth')

const cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.AWS_REGION })

// Get all users (manager only)
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can view all users' })
    const result = await cognito.listUsers({
      UserPoolId: process.env.COGNITO_USER_POOL_ID
    }).promise()
    res.json(result.Users)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    res.json(req.user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router