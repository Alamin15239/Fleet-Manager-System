'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function EmailManager() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Send single email
  const sendEmail = async (formData: FormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: formData.get('from'),
          to: formData.get('to'),
          subject: formData.get('subject'),
          html: formData.get('html'),
          scheduledAt: formData.get('scheduledAt') || undefined
        })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to send email' })
    }
    setLoading(false)
  }

  // Send batch emails
  const sendBatchEmails = async (formData: FormData) => {
    setLoading(true)
    try {
      const emails = JSON.parse(formData.get('emails') as string)
      const response = await fetch('/api/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to send batch emails' })
    }
    setLoading(false)
  }

  // Get email by ID
  const getEmail = async (formData: FormData) => {
    setLoading(true)
    try {
      const emailId = formData.get('emailId')
      const response = await fetch(`/api/emails/get/${emailId}`)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to get email' })
    }
    setLoading(false)
  }

  // Update email
  const updateEmail = async (formData: FormData) => {
    setLoading(true)
    try {
      const emailId = formData.get('emailId')
      const response = await fetch(`/api/emails/update/${emailId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: formData.get('scheduledAt')
        })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to update email' })
    }
    setLoading(false)
  }

  // Cancel email
  const cancelEmail = async (formData: FormData) => {
    setLoading(true)
    try {
      const emailId = formData.get('emailId')
      const response = await fetch(`/api/emails/cancel/${emailId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to cancel email' })
    }
    setLoading(false)
  }

  // Send maintenance alert
  const sendMaintenanceAlert = async (formData: FormData) => {
    setLoading(true)
    try {
      const response = await fetch('/api/emails/maintenance-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: formData.get('to'),
          truckId: formData.get('truckId'),
          maintenanceType: formData.get('maintenanceType'),
          dueDate: formData.get('dueDate'),
          urgency: formData.get('urgency')
        })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Failed to send maintenance alert' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="send"><LocalizedText>Send</LocalizedText></TabsTrigger>
          <TabsTrigger value="batch"><LocalizedText>Batch</LocalizedText></TabsTrigger>
          <TabsTrigger value="get"><LocalizedText>Get</LocalizedText></TabsTrigger>
          <TabsTrigger value="update"><LocalizedText>Update</LocalizedText></TabsTrigger>
          <TabsTrigger value="cancel"><LocalizedText>Cancel</LocalizedText></TabsTrigger>
          <TabsTrigger value="maintenance"><LocalizedText>Maintenance</LocalizedText></TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Send Email</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={sendEmail} className="space-y-4">
                <Input name="from" placeholder="From (e.g., Fleet Manager <noreply@resend.dev>)" required />
                <Input name="to" placeholder="To (email address)" required />
                <Input name="subject" placeholder="Subject" required />
                <Textarea name="html" placeholder="HTML content" rows={4} />
                <Input name="scheduledAt" type="datetime-local" placeholder="Schedule for later (optional)" />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Send Batch Emails</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={sendBatchEmails} className="space-y-4">
                <Textarea 
                  name="emails" 
                  placeholder={`[
  {
    "from": "Fleet Manager <noreply@resend.dev>",
    "to": "user1@example.com",
    "subject": "Test 1",
    "html": "<p>Hello User 1</p>"
  },
  {
    "from": "Fleet Manager <noreply@resend.dev>",
    "to": "user2@example.com", 
    "subject": "Test 2",
    "html": "<p>Hello User 2</p>"
  }
]`}
                  rows={10}
                  required
                />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Batch Emails'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="get">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Get Email</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={getEmail} className="space-y-4">
                <Input name="emailId" placeholder="Email ID" required />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Getting...' : 'Get Email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="update">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Update Email</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateEmail} className="space-y-4">
                <Input name="emailId" placeholder="Email ID" required />
                <Input name="scheduledAt" type="datetime-local" placeholder="New scheduled time" required />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancel">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Cancel Email</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={cancelEmail} className="space-y-4">
                <Input name="emailId" placeholder="Email ID" required />
                <Button type="submit" disabled={loading} variant="destructive">
                  {loading ? 'Canceling...' : 'Cancel Email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Send Maintenance Alert</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <form action={sendMaintenanceAlert} className="space-y-4">
                <Input name="to" placeholder="Recipient email" required />
                <Input name="truckId" placeholder="Truck ID" required />
                <Input name="maintenanceType" placeholder="Maintenance Type" required />
                <Input name="dueDate" type="date" placeholder="Due Date" required />
                <Select name="urgency" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low"><LocalizedText>Low</LocalizedText></SelectItem>
                    <SelectItem value="medium"><LocalizedText>Medium</LocalizedText></SelectItem>
                    <SelectItem value="high"><LocalizedText>High</LocalizedText></SelectItem>
                    <SelectItem value="critical"><LocalizedText>Critical</LocalizedText></SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Maintenance Alert'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle><LocalizedText>Result</LocalizedText></CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
