import { useEffect, useState } from "react"
import { DatabaseError } from "./DatabaseError"

interface DatabaseHealthCheckProps {
  children: React.ReactNode
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const response = await fetch("/api/health")
    return response.ok
  } catch {
    return false
  }
}

export function DatabaseHealthCheck({ children }: DatabaseHealthCheckProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null)

  useEffect(() => {
    async function checkHealth() {
      const healthy = await checkDatabaseHealth()
      setIsHealthy(healthy)
    }

    checkHealth()

    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isHealthy === null) {
    return null
  }

  if (!isHealthy) {
    return <DatabaseError />
  }

  return <>{children}</>
}

