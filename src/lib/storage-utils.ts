// Modern storage utilities to replace deprecated StorageType.persistent
export class StorageUtils {
  // Check if persistent storage is available and request it
  static async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
      return false
    }

    try {
      const isPersistent = await navigator.storage.persist()
      return isPersistent
    } catch (error) {
      return false
    }
  }

  // Get storage estimate
  static async getStorageEstimate() {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return null
    }

    try {
      const estimate = await navigator.storage.estimate()
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        usagePercentage: estimate.quota ? (estimate.usage! / estimate.quota) * 100 : 0
      }
    } catch (error) {
      return null
    }
  }

  // Initialize storage with modern APIs
  static async initializeStorage() {
    try {
      // Silently request persistent storage
      await this.requestPersistentStorage()
      
      // Get storage info without logging errors
      const estimate = await this.getStorageEstimate()
      if (estimate && estimate.quota > 0) {
        // Only log if we have valid storage info
        const percentage = estimate.usagePercentage.toFixed(1)
        if (percentage !== '0.0') {
          console.log(`Storage: ${estimate.usage} / ${estimate.quota} bytes (${percentage}%)`)
        }
      }
    } catch (error) {
      // Silently handle storage errors
    }
  }
}