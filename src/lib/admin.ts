export interface AdminStatus {
  isAdmin: boolean
}

export function fetchAdminStatus(): AdminStatus {
  const debugMode = localStorage.getItem('debugMode')
  
  
  const isAdmin = debugMode === 'contexrox'

  if (isAdmin) console.log("DEBUG MODE IS ENABLED", debugMode)
  
  return { isAdmin }
}


