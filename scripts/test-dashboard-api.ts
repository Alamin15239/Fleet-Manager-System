async function testDashboardAPI() {
  try {
    console.log('Testing dashboard stats API...')
    const response = await fetch('https://www.primeofferonline.shop/api/dashboard/stats')
    
    console.log('Response status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('Dashboard stats response:')
      console.log('- Total Trucks:', data.totalTrucks)
      console.log('- Active Trucks:', data.activeTrucks)
      console.log('- Total Trailers:', data.totalTrailers)
      console.log('- Active Trailers:', data.activeTrailers)
      console.log('- Recent Trucks:', data.recentTrucks?.length || 0)
    } else {
      const errorText = await response.text()
      console.log('API Error:', errorText)
    }
  } catch (error) {
    console.error('Fetch error:', error)
  }
}

testDashboardAPI()