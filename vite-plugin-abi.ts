import { readdir, readFile, writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import { join, resolve } from "path"
import type { Plugin } from "vite"

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

