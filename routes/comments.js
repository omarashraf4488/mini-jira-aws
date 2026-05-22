const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const TABLE = 'Comments'

// Get comments for a task
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const result = await dynamo.query({
      TableName: TABLE,
      IndexName: 'taskId-index',
      KeyConditionExpression: 'taskId = :taskId',
      ExpressionAttributeValues: { ':taskId': req.params.taskId }
    }).promise()
    res.json(result.Items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create comment
router.post('/', verifyToken, async (req, res) => {
  try {
    const comment = {
      commentId: uuidv4(),
      ...req.body,
      userId: req.user.userId,
      createdAt: new Date().toISOString()
    }
    await dynamo.put({ TableName: TABLE, Item: comment }).promise()
    res.status(201).json(comment)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router