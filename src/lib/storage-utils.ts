// Modern storage utilities to replace deprecated StorageType.persistent
export class StorageUtils {
  // Check if persistent storage is available and request it
  static async requestPersistentStorage(): Promise<boolean> {
    if (!('storage' in navigator) || !('persist' in navigator.storage)) {
      console.warn('Persistent storage not supported')
      return false
    }

    try {
      // Check if already persistent
      const isPersistent = await navigator.storage.persist()
      
      if (isPersistent) {
        console.log('Persistent storage granted')
      } else {
        console.log('Persistent storage denied')
      }
      
      return isPersistent
    } catch (error) {
      console.error('Error requesting persistent storage:', error)
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
        quota: estimate.quota,
        usage: estimate.usage,
        usagePercentage: estimate.quota ? (estimate.usage! / estimate.quota) * 100 : 0
      }
    } catch (error) {
      console.error('Error getting storage estimate:', error)
      return null
    }
  }

  // Initialize storage with modern APIs
  static async initializeStorage() {
    try {
      // Request persistent storage for better reliability
      await this.requestPersistentStorage()
      
      // Get storage info
      const estimate = await this.getStorageEstimate()
      if (estimate) {
        console.log(`Storage: ${estimate.usage} / ${estimate.quota} bytes (${estimate.usagePercentage.toFixed(1)}%)`)
      }
    } catch (error) {
      console.error('Storage initialization error:', error)
    }
  }
}