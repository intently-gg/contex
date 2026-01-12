import { readdir, readFile, writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import { join, resolve } from "path"
import type { Plugin } from "vite"
import { query, queryOne } from "./src/lib/db"

const ABI_DIR = "abis"
const VIRTUAL_MODULE_ID = "virtual:abis"
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID

export function abiPlugin(): Plugin {
  return {
    name: "abi-plugin",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const abisDir = resolve(process.cwd(), ABI_DIR)
        
        if (!existsSync(abisDir)) {
          await mkdir(abisDir, { recursive: true })
        }

        const files = await readdir(abisDir)
        const jsonFiles = files.filter((f) => f.endsWith(".json"))

        const abis: Record<string, unknown> = {}

        for (const file of jsonFiles) {
          try {
            const content = await readFile(join(abisDir, file), "utf-8")
            const abi = JSON.parse(content)
            abis[file] = abi
          } catch (error) {
            console.warn(`Failed to parse ${file}:`, error)
          }
        }

        return `export const abis = ${JSON.stringify(abis, null, 2)}`
      }
    },
    configureServer(server) {
      const abisDir = resolve(process.cwd(), ABI_DIR)
      
      // Verify database connection and table on startup
      ;(async () => {
        try {
          console.log("[DB CHECK] Testing PostgreSQL connection...")
          const { testConnection, query } = await import("./src/lib/db")
          
          const isConnected = await testConnection()
          if (!isConnected) {
            console.error("[DB CHECK] ❌ Failed to connect to PostgreSQL database")
            return
          }
          console.log("[DB CHECK] ✅ PostgreSQL connection successful")
          
          // Check if signatures table exists and is readable
          try {
            const result = await query("SELECT COUNT(*) as count FROM signatures")
            console.log(`[DB CHECK] ✅ Signatures table is readable (${result[0]?.count || 0} existing signatures)`)
          } catch (error) {
            console.error("[DB CHECK] ❌ Signatures table check failed:", error)
            console.error("[DB CHECK] Make sure you've run: psql -U postgres -d contex -f database/initialize.sql")
          }
        } catch (error) {
          console.error("[DB CHECK] ❌ Database initialization check failed:", error)
        }
      })()
      
      // Use a general middleware to catch all /api requests first
      server.middlewares.use((req, res, next) => {
        const url = req.url || ""
        if (url.startsWith("/api/disclaimer/check")) {
          return handleDisclaimerCheck(req, res)
        }
        if (url.startsWith("/api/disclaimer/sign")) {
          return handleDisclaimerSign(req, res)
        }
        if (url.startsWith("/api/health")) {
          return handleHealthCheck(req, res)
        }
        next()
      })
      
      async function handleHealthCheck(req: any, res: any) {
        if (req.method === "GET") {
          try {
            const { testConnection } = await import("./src/lib/db")
            const healthy = await testConnection()
            res.setHeader("Content-Type", "application/json")
            if (healthy) {
              res.end(JSON.stringify({ status: "ok" }))
            } else {
              res.statusCode = 503
              res.end(JSON.stringify({ status: "unavailable" }))
            }
          } catch (error) {
            res.statusCode = 503
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ status: "unavailable", error: String(error) }))
          }
        }
      }
      
      async function handleDisclaimerCheck(req: any, res: any) {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json")
          try {
            const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`)
            const walletAddress = url.searchParams.get("walletAddress")
            
            if (!walletAddress) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: "Missing walletAddress" }))
              return
            }

            const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || 
                              req.socket.remoteAddress || 
                              "unknown"

            const signature = await queryOne<{
              id: number
              wallet_address: string
              ip_address: string
              timestamp: Date
              version_id: string
              user_agent: string
              terms_hash: string
            }>(
              `SELECT * FROM signatures 
               WHERE ip_address = $1 AND wallet_address = $2`,
              [ipAddress, walletAddress.toLowerCase()]
            )

            if (signature) {
              res.end(JSON.stringify({
                signed: true,
                signature: {
                  walletAddress: signature.wallet_address,
                  timestamp: signature.timestamp.toISOString(),
                  versionId: signature.version_id,
                  ipAddress: signature.ip_address,
                  userAgent: signature.user_agent,
                  termsHash: signature.terms_hash,
                }
              }))
            } else {
              res.end(JSON.stringify({ signed: false }))
            }
          } catch (error) {
            console.error("[DISCLAIMER CHECK] Error:", error)
            res.statusCode = 500
            res.end(JSON.stringify({ error: "Database error" }))
          }
        }
      }
      
      async function handleDisclaimerSign(req: any, res: any) {
        if (req.method === "POST") {
          res.setHeader("Content-Type", "application/json")
          let body = ""
          req.on("data", (chunk) => {
            body += chunk.toString()
          })
          req.on("end", async () => {
            try {
              const { walletAddress, versionId } = JSON.parse(body)
              
              if (!walletAddress || !versionId) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: "Missing required fields" }))
                return
              }

              const { createHash } = await import("crypto")
              const DISCLAIMER_TEXT = `By using contex, you acknowledge it is an experimental beta feature provided 'as is' by intently [INTENTLY LLC]. We disclaim all warranties and assume no liability for any loss of funds, smart contract failures, or damages resulting from your use. You acknowledge that blockchain transactions are irreversible and that you are solely responsible for your own assets and risk. Use of contex does not constitute financial advice.`
              
              const termsHash = createHash("sha256")
                .update(DISCLAIMER_TEXT)
                .digest("hex")

              const ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || 
                                req.socket.remoteAddress || 
                                "unknown"
              const userAgent = req.headers["user-agent"] || "unknown"

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
              
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              console.error("[DISCLAIMER SIGN] Error:", error)
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(error) }))
            }
          })
        }
      }
      
      server.middlewares.use("/api/abis", async (req, res, next) => {
        if (req.method === "GET") {
          try {
            const files = await readdir(abisDir)
            const jsonFiles = files.filter((f) => f.endsWith(".json"))
            const abis: Record<string, unknown> = {}

            for (const file of jsonFiles) {
              try {
                const content = await readFile(join(abisDir, file), "utf-8")
                abis[file] = JSON.parse(content)
              } catch (error) {
                console.warn(`Failed to parse ${file}:`, error)
              }
            }

            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify(abis))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(error) }))
          }
        } else if (req.method === "POST") {
          let body = ""
          req.on("data", (chunk) => {
            body += chunk.toString()
          })
          req.on("end", async () => {
            try {
              const { filename, content } = JSON.parse(body)
              if (!filename || !content) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: "Missing filename or content" }))
                return
              }

              const filePath = join(abisDir, filename)
              await writeFile(filePath, JSON.stringify(JSON.parse(content), null, 2))
              
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(error) }))
            }
          })
        } else if (req.method === "DELETE") {
          const url = new URL(req.url || "", `http://${req.headers.host}`)
          const filename = url.searchParams.get("filename")
          
          if (!filename) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: "Missing filename" }))
            return
          }

          try {
            const filePath = join(abisDir, filename)
            if (existsSync(filePath)) {
              await unlink(filePath)
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ success: true }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: "File not found" }))
            }
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(error) }))
          }
        } else {
          next()
        }
      })

      server.middlewares.use("/api/contracts", async (req, res, next) => {
        if (req.method === "POST") {
          let body = ""
          req.on("data", (chunk) => {
            body += chunk.toString()
          })
          req.on("end", async () => {
            try {
              const contracts = JSON.parse(body)
              const contractsPath = resolve(process.cwd(), "contracts.json")
              await writeFile(contractsPath, JSON.stringify(contracts, null, 2))
              
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(error) }))
            }
          })
        } else {
          next()
        }
      })

      server.middlewares.use("/api/abi-labels", async (req, res, next) => {
        const labelsPath = resolve(process.cwd(), "public", "abi-labels.json")
        
        if (req.method === "GET") {
          try {
            if (existsSync(labelsPath)) {
              const content = await readFile(labelsPath, "utf-8")
              res.setHeader("Content-Type", "application/json")
              res.end(content)
            } else {
              res.setHeader("Content-Type", "application/json")
              res.end("{}")
            }
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(error) }))
          }
        } else if (req.method === "POST") {
          let body = ""
          req.on("data", (chunk) => {
            body += chunk.toString()
          })
          req.on("end", async () => {
            try {
              const labels = JSON.parse(body)
              await writeFile(labelsPath, JSON.stringify(labels, null, 2))
              
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ success: true }))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(error) }))
            }
          })
        } else {
          next()
        }
      })
    },
  }
}

