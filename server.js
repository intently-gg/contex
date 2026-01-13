import express from 'express'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'
import fs from 'fs/promises'
import { createHash } from 'crypto'

// Load .env from current working directory
config()

// Check for required environment variables
if (!process.env.ETHERSCAN_API_KEY) {
  console.error('ERROR: ETHERSCAN_API_KEY environment variable is required but not found')
  process.exit(1)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, 'dist')))

// Database connection
let pool = null
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'contex',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }
  return pool
}

async function query(text, params) {
  const pool = getPool()
  const result = await pool.query(text, params)
  return result.rows
}

async function queryOne(text, params) {
  const rows = await query(text, params)
  return rows[0] || null
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1')
    res.json({ status: 'ok' })
  } catch (error) {
    res.status(503).json({ status: 'unavailable', error: String(error) })
  }
})

// Disclaimer check
app.get('/api/disclaimer/check', async (req, res) => {
  try {
    const walletAddress = req.query.walletAddress
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' })
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.ip || 
                      'unknown'

    const signature = await queryOne(
      `SELECT * FROM signatures 
       WHERE ip_address = $1 AND wallet_address = $2`,
      [ipAddress, String(walletAddress).toLowerCase()]
    )

    if (signature) {
      res.json({
        signed: true,
        signature: {
          walletAddress: signature.wallet_address,
          timestamp: signature.timestamp.toISOString(),
          versionId: signature.version_id,
          ipAddress: signature.ip_address,
          userAgent: signature.user_agent,
          termsHash: signature.terms_hash,
        }
      })
    } else {
      res.json({ signed: false })
    }
  } catch (error) {
    console.error('[DISCLAIMER CHECK] Error:', error)
    res.status(500).json({ error: 'Database error' })
  }
})

// Disclaimer sign
app.post('/api/disclaimer/sign', async (req, res) => {
  try {
    const { walletAddress, versionId } = req.body
    
    if (!walletAddress || !versionId) {
      return res.status(400).json({ error: 'Missing walletAddress or versionId' })
    }

    const DISCLAIMER_TEXT = `By using contex, you acknowledge it is a beta feature provided 'as is' by intently [INTENTLY LLC]. We disclaim all warranties and assume no liability for any loss of funds, smart contract failures, or damages resulting from your use. You acknowledge that blockchain transactions are irreversible and that you are solely responsible for your own assets and risk.`
    
    const termsHash = createHash('sha256')
      .update(DISCLAIMER_TEXT)
      .digest('hex')

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                      req.ip || 
                      'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    await query(
      `INSERT INTO signatures (wallet_address, ip_address, version_id, user_agent, terms_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ip_address, wallet_address) 
       DO UPDATE SET 
         timestamp = NOW(),
         version_id = $3,
         user_agent = $4,
         terms_hash = $5`,
      [
        walletAddress.toLowerCase(),
        ipAddress,
        versionId,
        userAgent,
        termsHash,
      ]
    )

    res.json({ success: true })
  } catch (error) {
    console.error('[DISCLAIMER SIGN] Error:', error)
    res.status(500).json({ error: 'Database error' })
  }
})

// ABI labels - GET
app.get('/api/abi-labels', async (req, res) => {
  try {
    const labelsPath = path.join(__dirname, 'public', 'abi-labels.json')
    try {
      const content = await fs.readFile(labelsPath, 'utf-8')
      res.json(JSON.parse(content))
    } catch {
      res.json({})
    }
  } catch (error) {
    console.error('[ABI LABELS GET] Error:', error)
    res.status(500).json({ error: 'Failed to read labels' })
  }
})

// ABI labels - POST
app.post('/api/abi-labels', async (req, res) => {
  try {
    const labelsPath = path.join(__dirname, 'public', 'abi-labels.json')
    await fs.mkdir(path.dirname(labelsPath), { recursive: true })
    await fs.writeFile(labelsPath, JSON.stringify(req.body, null, 2))
    res.json({ success: true })
  } catch (error) {
    console.error('[ABI LABELS POST] Error:', error)
    res.status(500).json({ error: 'Failed to save labels' })
  }
})

// Fetch ABI from URL
app.post('/api/fetch-abi', async (req, res) => {
  try {
    const { url, address, chainId } = req.body

    let fetchUrl
    if (url) {
      fetchUrl = url
    } else if (address && chainId) {
      const apiKey = process.env.ETHERSCAN_API_KEY
      if (!apiKey) {
        console.error('[FETCH ABI] ETHERSCAN_API_KEY is not set!')
        return res.status(500).json({ error: 'ETHERSCAN_API_KEY is not configured on the server' })
      }
      fetchUrl = `https://api.etherscan.io/v2/api?apikey=${apiKey}&chainid=${chainId}&module=contract&action=getabi&address=${address}`
      console.log(`[FETCH ABI] Fetching from Etherscan: https://api.etherscan.io/v2/api?apikey=***&chainid=${chainId}&module=contract&action=getabi&address=${address}`)
    } else {
      return res.status(400).json({ error: 'Either url or both address and chainId must be provided' })
    }

    if (url) {
      console.log(`[FETCH ABI] Fetching from custom URL: ${url}`)
    }

    const response = await fetch(fetchUrl)
    const responseText = await response.text()
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      
      try {
        const errorData = JSON.parse(responseText)
        if (errorData.message) {
          errorMessage += `. Message: ${errorData.message}`
        }
        if (errorData.result) {
          errorMessage += `. Result: ${errorData.result}`
        }
      } catch {
        if (responseText) {
          errorMessage += `. Response: ${responseText.substring(0, 200)}`
        }
      }
      
      throw new Error(errorMessage)
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      throw new Error(`Failed to parse response as JSON. Response: ${responseText.substring(0, 200)}`)
    }

    let abi

    if (data.status === '1' && data.message === 'OK' && data.result) {
      abi = data.result
      if (typeof abi === 'string') {
        try {
          abi = JSON.parse(abi)
        } catch (firstParseError) {
          try {
            const unescaped = abi.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
            abi = JSON.parse(unescaped)
          } catch (secondParseError) {
            try {
              abi = JSON.parse(JSON.parse(JSON.stringify(abi)))
            } catch (thirdParseError) {
              throw new Error('Failed to parse ABI from response')
            }
          }
        }
      }
    } else if (Array.isArray(data)) {
      abi = data
    } else if (Array.isArray(data.result)) {
      abi = data.result
    } else {
      throw new Error(data.message || 'Failed to fetch ABI')
    }

    if (!Array.isArray(abi)) {
      throw new Error('ABI must be an array')
    }

    res.json({ success: true, abi })
  } catch (error) {
    console.error('[FETCH ABI] Error:', error)
    let errorMessage = error instanceof Error ? error.message : 'Failed to fetch ABI'
    
    if (errorMessage.includes('URL:')) {
      errorMessage = errorMessage.split('URL:')[0].trim()
    }
    
    res.status(500).json({ 
      error: errorMessage
    })
  }
})

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const port = process.env.PORT || process.env.VITE_PORT || 3000
app.listen(port, () => {
  console.log(`Server running on port ${port}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

