const express = require('express')
const router = express.Router()
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { verifyToken } = require('./auth')

const dynamo = new AWS.DynamoDB.DocumentClient({ region: process.env.AWS_REGION })
const TABLE = 'Teams'

// Get all teams
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await dynamo.scan({ TableName: TABLE }).promise()
    res.json(result.Items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Create team (manager only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can create teams' })
    const team = {
      teamId: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString()
    }
    await dynamo.put({ TableName: TABLE, Item: team }).promise()
    res.status(201).json(team)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update team (manager only)
router.put('/:teamId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can update teams' })
    const existing = await dynamo.get({
      TableName: TABLE,
      Key: { teamId: req.params.teamId }
    }).promise()
    if (!existing.Item) return res.status(404).json({ error: 'Team not found' })
    const updated = { ...existing.Item, ...req.body, teamId: req.params.teamId }
    await dynamo.put({ TableName: TABLE, Item: updated }).promise()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete team (manager only)
router.delete('/:teamId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Only managers can delete teams' })
    await dynamo.delete({
      TableName: TABLE,
      Key: { teamId: req.params.teamId }
    }).promise()
    res.json({ message: 'Team deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router