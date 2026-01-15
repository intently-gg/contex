import { CONTEX_VERSION, RELEASE_NOTES } from "./config"

const RELEASE_NOTES_VERSION_KEY = "contex-release-notes-version"

/**
 * Compares two version strings (e.g., "0.24" vs "0.25")
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number)
  const parts2 = v2.split(".").map(Number)
  
  const maxLength = Math.max(parts1.length, parts2.length)
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0
    const part2 = parts2[i] || 0
    
    if (part1 < part2) return -1
    if (part1 > part2) return 1
  }
  
  return 0
}

/**
 * Gets the last shown release notes version from localStorage
 */
export function getLastShownVersion(): string | null {
  return localStorage.getItem(RELEASE_NOTES_VERSION_KEY)
}

/**
 * Sets the last shown release notes version in localStorage
 */
export function setLastShownVersion(version: string): void {
  localStorage.setItem(RELEASE_NOTES_VERSION_KEY, version)
}

/**
 * Gets all release notes for versions between lastShownVersion (exclusive) and CONTEX_VERSION (inclusive)
 * Returns an object with version as key and release notes as value, sorted by version
 */
export function getReleaseNotesToShow(
  lastShownVersion: string | null,
  currentVersion: string = CONTEX_VERSION
): Record<string, { whatsnew: Record<string, string[]> }> {
  const notesToShow: Record<string, { whatsnew: Record<string, string[]> }> = {}
  
  // Get all version keys from RELEASE_NOTES and sort them
  const availableVersions = Object.keys(RELEASE_NOTES).sort(compareVersions)
  
  // If no last shown version, show all notes up to current version
  if (!lastShownVersion) {
    for (const version of availableVersions) {
      if (compareVersions(version, currentVersion) <= 0) {
        notesToShow[version] = RELEASE_NOTES[version as keyof typeof RELEASE_NOTES]
      }
    }
    return notesToShow
  }
  
  // Show notes for versions greater than lastShownVersion and <= currentVersion
  for (const version of availableVersions) {
    if (
      compareVersions(version, lastShownVersion) > 0 &&
      compareVersions(version, currentVersion) <= 0
    ) {
      notesToShow[version] = RELEASE_NOTES[version as keyof typeof RELEASE_NOTES]
    }
  }
  
  return notesToShow
}

/**
 * Checks if there are any release notes to show
 */
export function hasReleaseNotesToShow(
  lastShownVersion: string | null,
  currentVersion: string = CONTEX_VERSION
): boolean {
  const notes = getReleaseNotesToShow(lastShownVersion, currentVersion)
  return Object.keys(notes).length > 0
}

