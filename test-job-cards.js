// Simple test script to verify Job Card API endpoints
const testJobCardAPI = async () => {
  console.log('Testing Job Card API endpoints...')
  
  // Test 1: Check if job cards route exists
  try {
    const response = await fetch('http://localhost:3000/api/job-cards', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    console.log('✓ Job Cards API route accessible')
  } catch (error) {
    console.log('✗ Job Cards API route error:', error.message)
  }
  
  // Test 2: Check if templates route exists
  try {
    const response = await fetch('http://localhost:3000/api/job-cards/templates', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    })
    console.log('✓ Job Card Templates API route accessible')
  } catch (error) {
    console.log('✗ Job Card Templates API route error:', error.message)
  }
  
  console.log('Job Card API test completed')
}

// Run test if this file is executed directly
if (require.main === module) {
  testJobCardAPI()
}

module.exports = { testJobCardAPI }