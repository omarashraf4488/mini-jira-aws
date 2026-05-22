const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const TABLE = 'Projects'

// Get all projects
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await dynamo.scan({ TableName: TABLE }).promise()
    res.json(result.Items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get single project
router.get('/:projectId', verifyToken, async (req, res) => {
  try {
    const result = await dynamo.get({
      TableName: TABLE,
      Key: { projectId: req.params.projectId }
    }).promise()
    if (!result.Item) return res.status(404).json({ error: 'Project not found' })
    res.json(result.Item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create project (manager only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can create projects' })
    const project = {
      projectId: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString()
    }
    await dynamo.put({ TableName: TABLE, Item: project }).promise()
    res.status(201).json(project)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update project (manager only)
router.put('/:projectId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can update projects' })
    const existing = await dynamo.get({
      TableName: TABLE,
      Key: { projectId: req.params.projectId }
    }).promise()
    if (!existing.Item) return res.status(404).json({ error: 'Project not found' })
    const updated = { ...existing.Item, ...req.body, projectId: req.params.projectId }
    await dynamo.put({ TableName: TABLE, Item: updated }).promise()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete project (manager only)
router.delete('/:projectId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can delete projects' })
    await dynamo.delete({
      TableName: TABLE,
      Key: { projectId: req.params.projectId }
    }).promise()
    res.json({ message: 'Project deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router