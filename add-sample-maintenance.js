// Sample maintenance data script
// Run this in your browser console on the maintenance page

const sampleMaintenanceRecords = [
  {
    truckId: "cm5aqhqhj0000uxqhqhqhqhqh", // Replace with your actual truck ID
    serviceType: "Oil Change",
    description: "Regular oil change and filter replacement",
    datePerformed: "2024-12-01",
    partsCost: 45.00,
    laborCost: 35.00,
    status: "COMPLETED",
    notes: "Used synthetic oil, next change due in 5000 km"
  },
  {
    truckId: "cm5aqhqhj0000uxqhqhqhqhqh", // Replace with your actual truck ID
    serviceType: "Brake Inspection",
    description: "Routine brake system inspection and pad replacement",
    datePerformed: "2024-11-15",
    partsCost: 120.00,
    laborCost: 80.00,
    status: "COMPLETED",
    notes: "Front brake pads replaced, rear pads still good"
  },
  {
    truckId: "cm5aqhqhj0000uxqhqhqhqhqh", // Replace with your actual truck ID
    serviceType: "Tire Rotation",
    description: "Tire rotation and pressure check",
    datePerformed: "2024-11-01",
    partsCost: 0.00,
    laborCost: 25.00,
    status: "COMPLETED",
    notes: "All tires rotated, pressure adjusted to specification"
  },
  {
    truckId: "cm5aqhqhj0000uxqhqhqhqhqh", // Replace with your actual truck ID
    serviceType: "Engine Diagnostic",
    description: "Check engine light diagnostic",
    datePerformed: "2024-10-20",
    partsCost: 15.00,
    laborCost: 60.00,
    status: "COMPLETED",
    notes: "Replaced faulty oxygen sensor, cleared error codes"
  },
  {
    truckId: "cm5aqhqhj0000uxqhqhqhqhqh", // Replace with your actual truck ID
    serviceType: "Transmission Service",
    description: "Transmission fluid change and filter replacement",
    datePerformed: "2024-10-05",
    partsCost: 85.00,
    laborCost: 120.00,
    status: "COMPLETED",
    notes: "Transmission fluid and filter changed, system running smoothly"
  }
];

// Function to add maintenance records
async function addSampleMaintenance() {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    console.error('No auth token found. Please login first.');
    return;
  }

  for (const record of sampleMaintenanceRecords) {
    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(record)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Added maintenance record: ${record.serviceType}`);
      } else {
        const error = await response.json();
        console.error(`❌ Failed to add ${record.serviceType}:`, error);
      }
    } catch (error) {
      console.error(`❌ Error adding ${record.serviceType}:`, error);
    }
  }
  
  console.log('🎉 Sample maintenance records added! Refresh the page to see them.');
}

// Instructions
console.log('📋 Sample Maintenance Data Script');
console.log('1. Make sure you are logged in');
console.log('2. Update the truckId in the script with your actual truck ID');
console.log('3. Run: addSampleMaintenance()');
console.log('');
console.log('Your current truck ID should be the ID from your truck. Check the network tab or database.');

// Auto-run if you want
// addSampleMaintenance();