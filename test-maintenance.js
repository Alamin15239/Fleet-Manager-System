// Quick test to check maintenance data
const testMaintenanceAPI = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/maintenance?limit=5')
    const data = await response.json()
    console.log('Maintenance API Response:', JSON.stringify(data, null, 2))
    
    if (data.records && data.records.length > 0) {
      console.log('First record costs:', {
        partsCost: data.records[0].partsCost,
        laborCost: data.records[0].laborCost,
        totalCost: data.records[0].totalCost,
        types: {
          partsCost: typeof data.records[0].partsCost,
          laborCost: typeof data.records[0].laborCost,
          totalCost: typeof data.records[0].totalCost
        }
      })
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testMaintenanceAPI()