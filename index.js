const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

// Routes
try {
  app.use('/api/tasks', require('./routes/tasks'))
  app.use('/api/projects', require('./routes/projects'))
  app.use('/api/comments', require('./routes/comments'))
  app.use('/api/teams', require('./routes/teams'))
  app.use('/api/users', require('./routes/users'))
  app.use('/api/upload', require('./routes/upload'))
} catch(err) {
  console.error('Route error:', err.message)
}

  


const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  .on('error', (err) => console.error('Server error:', err.message))
  