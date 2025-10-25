export async function testDashboardAPI() {
  try {
    console.log('Testing dashboard stats API...')
    const response = await fetch('http://localhost:3000/api/dashboard/stats')
    
    if (response.ok) {
      const data = await response.json()
      console.log('Dashboard stats:', JSON.stringify(data, null, 2))
    } else {
      console.log('API Error:', response.status, response.statusText)
      const errorText = await response.text()
      console.log('Error details:', errorText)
    }
  } catch (error) {
    console.error('Fetch error:', error)
  }
}

if (require.main === module) {
  testDashboardAPI()
}