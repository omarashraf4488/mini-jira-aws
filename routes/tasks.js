console.log('tasks.js loaded')
const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const sns = new AWS.SNS({ region: process.env.AWS_REGION })
const TABLE = 'Tasks'
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:717094201142:mini-jira-task-assigned'

// Get all tasks
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('GET /tasks user:', req.user)
    const { role, teamId } = req.user
    let result

    if (role === 'manager') {
      result = await dynamo.scan({ TableName: TABLE }).promise()
    } else {
      result = await dynamo.query({
        TableName: TABLE,
        IndexName: 'teamId-index',
        KeyConditionExpression: 'teamId = :teamId',
        ExpressionAttributeValues: { ':teamId': teamId }
      }).promise()
    }

    res.json(result.Items)
  } catch (err) {
    console.error('GET /tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Get single task
router.get('/:taskId', verifyToken, async (req, res) => {
  try {
    const { role, teamId } = req.user
    const result = await dynamo.get({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    if (!result.Item) return res.status(404).json({ error: 'Task not found' })
    if (role !== 'manager' && result.Item.teamId !== teamId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(result.Item)
  } catch (err) {
    console.error('GET /tasks/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Create task
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('POST /tasks user:', req.user)
    console.log('POST /tasks body:', req.body)
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can create tasks' })

    const task = {
      taskId: uuidv4(),
      ...req.body,
      status: 'To Do',
      createdAt: new Date().toISOString(),
      auditLog: []
    }

    await dynamo.put({ TableName: TABLE, Item: task }).promise()

    // Publish SNS notification
    try {
      await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Message: `Task "${task.title}" has been assigned to ${task.assignee}`,
        Subject: 'New Task Assigned - Mini Jira'
      }).promise()
      console.log('SNS notification sent')
    } catch (snsErr) {
      console.error('SNS error:', snsErr.message)
    }

    res.status(201).json(task)
  } catch (err) {
    console.error('POST /tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Update task
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    const { role, teamId, userId } = req.user
    const existing = await dynamo.get({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    if (!existing.Item) return res.status(404).json({ error: 'Task not found' })
    if (role !== 'manager' && existing.Item.teamId !== teamId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const auditEntry = {
      changedBy: userId,
      changedAt: new Date().toISOString(),
      oldStatus: existing.Item.status,
      newStatus: req.body.status || existing.Item.status
    }

    const updated = {
      ...existing.Item,
      ...req.body,
      taskId: req.params.taskId,
      auditLog: [...(existing.Item.auditLog || []), auditEntry]
    }

    await dynamo.put({ TableName: TABLE, Item: updated }).promise()
    res.json(updated)
  } catch (err) {
    console.error('PUT /tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Delete task
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can delete tasks' })

    await dynamo.delete({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    res.json({ message: 'Task deleted' })
  } catch (err) {
    console.error('DELETE /tasks error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router