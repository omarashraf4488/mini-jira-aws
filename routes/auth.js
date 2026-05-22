const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    const signingKey = key.publicKey || key.rsaPublicKey
    callback(null, signingKey)
  })
}

const VALID_ROLES = ['manager', 'employee', 'admin']

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No token provided' })
  
  const token = authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Invalid token format' })

  const expectedIssuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`

  jwt.verify(token, getKey, { 
    algorithms: ['RS256'],
    issuer: expectedIssuer,
    audience: process.env.COGNITO_CLIENT_ID
  }, (err, decoded) => {
    if (err) {
      console.error('Token error:', err.message)
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Validate token_use is id token
    if (decoded.token_use !== 'id') {
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Validate role is allowed
    const role = decoded['custom:role']
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Invalid role' })
    }

    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: role,
      teamId: decoded['custom:teamId'] || ''
    }
    next()
  })
}

module.exports = { verifyToken }