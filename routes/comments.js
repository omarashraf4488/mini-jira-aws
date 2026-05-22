const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })

// Get comments for a task (with team isolation check)
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { role, teamId } = req.user
    
    // First verify the task belongs to user's team
    if (role !== 'manager') {
      const task = await dynamo.get({ TableName: 'Tasks', Key: { taskId: req.params.taskId } }).promise()
      if (!task.Item || task.Item.teamId !== teamId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const result = await dynamo.query({
      TableName: 'Comments',
      IndexName: 'taskId-index',
      KeyConditionExpression: 'taskId = :taskId',
      ExpressionAttributeValues: { ':taskId': req.params.taskId }
    }).promise()
    res.json(result.Items)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Create comment (with team isolation check)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { role, teamId } = req.user

    // First verify the task belongs to user's team
    if (role !== 'manager') {
      const task = await dynamo.get({ TableName: 'Tasks', Key: { taskId: req.body.taskId } }).promise()
      if (!task.Item || task.Item.teamId !== teamId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const comment = { commentId: uuidv4(), ...req.body, userId: req.user.userId, createdAt: new Date().toISOString() }
    await dynamo.put({ TableName: 'Comments', Item: comment }).promise()
    res.status(201).json(comment)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router