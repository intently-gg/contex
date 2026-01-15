export interface AdminStatus {
  isAdmin: boolean
}

export function fetchAdminStatus(): AdminStatus {
  const debugMode = localStorage.getItem('debugMode')
  console.log("[ADMIN STATUS] debugMode value:", debugMode)
  
  const isAdmin = debugMode === 'contexrox'
  
  return { isAdmin }
}


