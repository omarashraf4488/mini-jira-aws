console.log('tasks.js loaded')
const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const sns = new AWS.SNS({ region: process.env.AWS_REGION })
const s3 = new AWS.S3({ region: process.env.AWS_REGION })
const TABLE = 'Tasks'
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:717094201142:mini-jira-task-assigned'
const S3_BUCKET = 'mini-jira-images-originals'

// Get all tasks
router.get('/', verifyToken, async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message })
  }
})

// Create task (manager only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can create tasks' })

    const task = {
      taskId: uuidv4(),
      ...req.body,
      status: 'To Do',
      createdAt: new Date().toISOString(),
      auditLog: []
    }

    await dynamo.put({ TableName: TABLE, Item: task }).promise()

    try {
      await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Message: `Task "${task.title}" has been assigned to ${task.assignee}`,
        Subject: 'New Task Assigned - Mini Jira'
      }).promise()
    } catch (snsErr) {
      console.error('SNS error:', snsErr.message)
    }

    res.status(201).json(task)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update task
router.put('/:taskId', verifyToken, async (req, res) => {
  try {
    const { role, teamId, userId, email } = req.user
    const existing = await dynamo.get({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    if (!existing.Item) return res.status(404).json({ error: 'Task not found' })
    
    // Team isolation check
    if (role !== 'manager' && existing.Item.teamId !== teamId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Employees can only update status of tasks assigned to them
    if (role === 'employee') {
      if (existing.Item.assignee !== email) {
        return res.status(403).json({ error: 'You can only update tasks assigned to you' })
      }
    }

    // Employees can only update status, managers can update everything
    const allowedUpdate = role === 'manager' ? req.body : { status: req.body.status }

    const auditEntry = {
      changedBy: userId,
      changedAt: new Date().toISOString(),
      oldStatus: existing.Item.status,
      newStatus: allowedUpdate.status || existing.Item.status
    }

    const updated = {
      ...existing.Item,
      ...allowedUpdate,
      taskId: req.params.taskId,
      auditLog: [...(existing.Item.auditLog || []), auditEntry]
    }

    await dynamo.put({ TableName: TABLE, Item: updated }).promise()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete task (manager only) - also deletes image from S3
router.delete('/:taskId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can delete tasks' })

    // Get task first to find image
    const existing = await dynamo.get({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    // Delete image from S3 if exists
    if (existing.Item && existing.Item.imageKey) {
      try {
        await s3.deleteObject({
          Bucket: S3_BUCKET,
          Key: existing.Item.imageKey
        }).promise()
      } catch (s3Err) {
        console.error('S3 delete error:', s3Err.message)
      }
    }

    await dynamo.delete({
      TableName: TABLE,
      Key: { taskId: req.params.taskId }
    }).promise()

    res.json({ message: 'Task deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router