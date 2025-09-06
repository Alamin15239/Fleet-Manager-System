'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, Mail, Receipt, Clipboard, Users, Building, 
  Calendar, DollarSign, Truck, Wrench, BarChart3, FileImage
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  content: string;
  variables?: string[];
}

const templates: Template[] = [
  {
    id: 'maintenance-report',
    name: 'Maintenance Report',
    category: 'Fleet Management',
    description: 'Comprehensive vehicle maintenance report template',
    icon: <Wrench className="h-6 w-6" />,
    content: `
      <h1>Vehicle Maintenance Report</h1>
      <div style="margin: 20px 0;">
        <p><strong>Vehicle ID:</strong> {{vehicleId}}</p>
        <p><strong>License Plate:</strong> {{licensePlate}}</p>
        <p><strong>Date:</strong> {{date}}</p>
        <p><strong>Mechanic:</strong> {{mechanicName}}</p>
        <p><strong>Mileage:</strong> {{mileage}}</p>
      </div>
      
      <h2>Services Performed</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Service Type</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Description</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Parts Cost</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Labor Cost</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">{{serviceType}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{serviceDescription}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{partsCost}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{laborCost}}</td>
        </tr>
      </table>
      
      <h2>Recommendations</h2>
      <p>{{recommendations}}</p>
      
      <h2>Next Service Due</h2>
      <p><strong>Date:</strong> {{nextServiceDate}}</p>
      <p><strong>Mileage:</strong> {{nextServiceMileage}}</p>
    `,
    variables: ['vehicleId', 'licensePlate', 'date', 'mechanicName', 'mileage', 'serviceType', 'serviceDescription', 'partsCost', 'laborCost', 'recommendations', 'nextServiceDate', 'nextServiceMileage']
  },
  {
    id: 'fleet-inspection',
    name: 'Fleet Inspection Checklist',
    category: 'Fleet Management',
    description: 'Comprehensive vehicle inspection checklist',
    icon: <Clipboard className="h-6 w-6" />,
    content: `
      <h1>Fleet Vehicle Inspection Checklist</h1>
      <div style="margin: 20px 0;">
        <p><strong>Vehicle:</strong> {{vehicleInfo}}</p>
        <p><strong>Inspector:</strong> {{inspectorName}}</p>
        <p><strong>Date:</strong> {{inspectionDate}}</p>
        <p><strong>Mileage:</strong> {{currentMileage}}</p>
      </div>
      
      <h2>Exterior Inspection</h2>
      <div style="margin: 15px 0;">
        <p>☐ Body condition (dents, scratches, rust)</p>
        <p>☐ Paint condition</p>
        <p>☐ Lights (headlights, taillights, indicators)</p>
        <p>☐ Mirrors</p>
        <p>☐ Windshield and windows</p>
        <p>☐ Tires (tread depth, pressure, wear pattern)</p>
        <p>☐ License plates</p>
      </div>
      
      <h2>Interior Inspection</h2>
      <div style="margin: 15px 0;">
        <p>☐ Seats and seatbelts</p>
        <p>☐ Dashboard and instruments</p>
        <p>☐ Steering wheel</p>
        <p>☐ Pedals</p>
        <p>☐ Interior lights</p>
        <p>☐ Air conditioning/heating</p>
        <p>☐ Radio/communication equipment</p>
      </div>
      
      <h2>Engine and Mechanical</h2>
      <div style="margin: 15px 0;">
        <p>☐ Engine oil level and condition</p>
        <p>☐ Coolant level</p>
        <p>☐ Brake fluid</p>
        <p>☐ Battery condition</p>
        <p>☐ Belts and hoses</p>
        <p>☐ Exhaust system</p>
      </div>
      
      <h2>Overall Assessment</h2>
      <p><strong>Vehicle Condition:</strong> ☐ Excellent ☐ Good ☐ Fair ☐ Poor</p>
      <p><strong>Immediate Repairs Needed:</strong> {{immediateRepairs}}</p>
      <p><strong>Recommended Maintenance:</strong> {{recommendedMaintenance}}</p>
      
      <div style="margin-top: 40px;">
        <p><strong>Inspector Signature:</strong> _________________________</p>
        <p><strong>Date:</strong> _________________________</p>
      </div>
    `,
    variables: ['vehicleInfo', 'inspectorName', 'inspectionDate', 'currentMileage', 'immediateRepairs', 'recommendedMaintenance']
  },
  {
    id: 'business-letter',
    name: 'Business Letter',
    category: 'Business',
    description: 'Professional business letter template',
    icon: <Mail className="h-6 w-6" />,
    content: `
      <div style="text-align: right; margin-bottom: 40px;">
        <p>{{companyName}}</p>
        <p>{{companyAddress}}</p>
        <p>{{companyCity}}, {{companyState}} {{companyZip}}</p>
        <p>{{companyPhone}}</p>
        <p>{{companyEmail}}</p>
      </div>
      
      <p>{{date}}</p>
      
      <div style="margin: 40px 0;">
        <p>{{recipientName}}</p>
        <p>{{recipientTitle}}</p>
        <p>{{recipientCompany}}</p>
        <p>{{recipientAddress}}</p>
        <p>{{recipientCity}}, {{recipientState}} {{recipientZip}}</p>
      </div>
      
      <p>Dear {{recipientName}},</p>
      
      <p>{{letterBody}}</p>
      
      <p>{{closingParagraph}}</p>
      
      <p>Sincerely,</p>
      
      <div style="margin-top: 60px;">
        <p>{{senderName}}</p>
        <p>{{senderTitle}}</p>
        <p>{{senderCompany}}</p>
      </div>
    `,
    variables: ['companyName', 'companyAddress', 'companyCity', 'companyState', 'companyZip', 'companyPhone', 'companyEmail', 'date', 'recipientName', 'recipientTitle', 'recipientCompany', 'recipientAddress', 'recipientCity', 'recipientState', 'recipientZip', 'letterBody', 'closingParagraph', 'senderName', 'senderTitle', 'senderCompany']
  },
  {
    id: 'invoice-template',
    name: 'Service Invoice',
    category: 'Financial',
    description: 'Professional service invoice template',
    icon: <Receipt className="h-6 w-6" />,
    content: `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
        <div>
          <h1 style="color: #2196f3; margin: 0;">INVOICE</h1>
          <p style="margin: 5px 0;"><strong>Invoice #:</strong> {{invoiceNumber}}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> {{invoiceDate}}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; color: #333;">{{companyName}}</h3>
          <p style="margin: 2px 0;">{{companyAddress}}</p>
          <p style="margin: 2px 0;">{{companyCity}}, {{companyState}} {{companyZip}}</p>
          <p style="margin: 2px 0;">{{companyPhone}}</p>
          <p style="margin: 2px 0;">{{companyEmail}}</p>
        </div>
      </div>
      
      <div style="margin: 40px 0;">
        <h3>Bill To:</h3>
        <p><strong>{{clientName}}</strong></p>
        <p>{{clientAddress}}</p>
        <p>{{clientCity}}, {{clientState}} {{clientZip}}</p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Description</th>
            <th style="border: 1px solid #dee2e6; padding: 12px; text-align: center;">Quantity</th>
            <th style="border: 1px solid #dee2e6; padding: 12px; text-align: right;">Rate</th>
            <th style="border: 1px solid #dee2e6; padding: 12px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #dee2e6; padding: 12px;">{{serviceDescription}}</td>
            <td style="border: 1px solid #dee2e6; padding: 12px; text-align: center;">{{quantity}}</td>
            <td style="border: 1px solid #dee2e6; padding: 12px; text-align: right;">{{rate}}</td>
            <td style="border: 1px solid #dee2e6; padding: 12px; text-align: right;">{{amount}}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="text-align: right; margin-top: 30px;">
        <p><strong>Subtotal: {{subtotal}}</strong></p>
        <p><strong>Tax ({{taxRate}}%): {{taxAmount}}</strong></p>
        <h3 style="color: #2196f3; border-top: 2px solid #2196f3; padding-top: 10px;">Total: {{total}}</h3>
      </div>
      
      <div style="margin-top: 40px;">
        <h4>Payment Terms:</h4>
        <p>{{paymentTerms}}</p>
        
        <h4>Notes:</h4>
        <p>{{notes}}</p>
      </div>
    `,
    variables: ['invoiceNumber', 'invoiceDate', 'dueDate', 'companyName', 'companyAddress', 'companyCity', 'companyState', 'companyZip', 'companyPhone', 'companyEmail', 'clientName', 'clientAddress', 'clientCity', 'clientState', 'clientZip', 'serviceDescription', 'quantity', 'rate', 'amount', 'subtotal', 'taxRate', 'taxAmount', 'total', 'paymentTerms', 'notes']
  },
  {
    id: 'meeting-minutes',
    name: 'Meeting Minutes',
    category: 'Business',
    description: 'Professional meeting minutes template',
    icon: <Users className="h-6 w-6" />,
    content: `
      <h1>Meeting Minutes</h1>
      
      <div style="margin: 20px 0;">
        <p><strong>Meeting Title:</strong> {{meetingTitle}}</p>
        <p><strong>Date:</strong> {{meetingDate}}</p>
        <p><strong>Time:</strong> {{meetingTime}}</p>
        <p><strong>Location:</strong> {{meetingLocation}}</p>
        <p><strong>Chair:</strong> {{chairperson}}</p>
        <p><strong>Secretary:</strong> {{secretary}}</p>
      </div>
      
      <h2>Attendees</h2>
      <ul>
        <li>{{attendee1}}</li>
        <li>{{attendee2}}</li>
        <li>{{attendee3}}</li>
      </ul>
      
      <h2>Agenda Items</h2>
      
      <h3>1. {{agendaItem1}}</h3>
      <p><strong>Discussion:</strong> {{discussion1}}</p>
      <p><strong>Decision:</strong> {{decision1}}</p>
      <p><strong>Action Items:</strong> {{actionItems1}}</p>
      
      <h3>2. {{agendaItem2}}</h3>
      <p><strong>Discussion:</strong> {{discussion2}}</p>
      <p><strong>Decision:</strong> {{decision2}}</p>
      <p><strong>Action Items:</strong> {{actionItems2}}</p>
      
      <h2>Action Items Summary</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Action Item</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Assigned To</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Due Date</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Status</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">{{actionItem}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{assignedTo}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{dueDate}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{status}}</td>
        </tr>
      </table>
      
      <h2>Next Meeting</h2>
      <p><strong>Date:</strong> {{nextMeetingDate}}</p>
      <p><strong>Time:</strong> {{nextMeetingTime}}</p>
      <p><strong>Location:</strong> {{nextMeetingLocation}}</p>
      
      <div style="margin-top: 40px;">
        <p><strong>Minutes prepared by:</strong> {{secretary}}</p>
        <p><strong>Date:</strong> {{preparationDate}}</p>
      </div>
    `,
    variables: ['meetingTitle', 'meetingDate', 'meetingTime', 'meetingLocation', 'chairperson', 'secretary', 'attendee1', 'attendee2', 'attendee3', 'agendaItem1', 'discussion1', 'decision1', 'actionItems1', 'agendaItem2', 'discussion2', 'decision2', 'actionItems2', 'actionItem', 'assignedTo', 'dueDate', 'status', 'nextMeetingDate', 'nextMeetingTime', 'nextMeetingLocation', 'preparationDate']
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    category: 'Business',
    description: 'Comprehensive project proposal template',
    icon: <FileText className="h-6 w-6" />,
    content: `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="color: #2196f3;">{{projectTitle}}</h1>
        <h2>Project Proposal</h2>
        <p>Prepared for: {{clientName}}</p>
        <p>Prepared by: {{companyName}}</p>
        <p>Date: {{proposalDate}}</p>
      </div>
      
      <h2>Executive Summary</h2>
      <p>{{executiveSummary}}</p>
      
      <h2>Project Overview</h2>
      <h3>Objectives</h3>
      <ul>
        <li>{{objective1}}</li>
        <li>{{objective2}}</li>
        <li>{{objective3}}</li>
      </ul>
      
      <h3>Scope of Work</h3>
      <p>{{scopeOfWork}}</p>
      
      <h3>Deliverables</h3>
      <ul>
        <li>{{deliverable1}}</li>
        <li>{{deliverable2}}</li>
        <li>{{deliverable3}}</li>
      </ul>
      
      <h2>Timeline</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Phase</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Description</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Duration</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Deliverable</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">Phase 1</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase1Description}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase1Duration}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase1Deliverable}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">Phase 2</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase2Description}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase2Duration}}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">{{phase2Deliverable}}</td>
        </tr>
      </table>
      
      <h2>Budget</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Item</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Cost</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">{{budgetItem1}}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">{{budgetCost1}}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 12px;">{{budgetItem2}}</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">{{budgetCost2}}</td>
        </tr>
        <tr style="background: #f5f5f5; font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 12px;">Total</td>
          <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">{{totalBudget}}</td>
        </tr>
      </table>
      
      <h2>Team</h2>
      <p>{{teamDescription}}</p>
      
      <h2>Next Steps</h2>
      <p>{{nextSteps}}</p>
      
      <div style="margin-top: 40px;">
        <p><strong>Contact Information:</strong></p>
        <p>{{contactName}}</p>
        <p>{{contactTitle}}</p>
        <p>{{contactEmail}}</p>
        <p>{{contactPhone}}</p>
      </div>
    `,
    variables: ['projectTitle', 'clientName', 'companyName', 'proposalDate', 'executiveSummary', 'objective1', 'objective2', 'objective3', 'scopeOfWork', 'deliverable1', 'deliverable2', 'deliverable3', 'phase1Description', 'phase1Duration', 'phase1Deliverable', 'phase2Description', 'phase2Duration', 'phase2Deliverable', 'budgetItem1', 'budgetCost1', 'budgetItem2', 'budgetCost2', 'totalBudget', 'teamDescription', 'nextSteps', 'contactName', 'contactTitle', 'contactEmail', 'contactPhone']
  }
];

interface DocumentTemplatesProps {
  onSelectTemplate: (template: Template) => void;
}

export default function DocumentTemplates({ onSelectTemplate }: DocumentTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="text-blue-600">
                  {template.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.category}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {template.description}
              </p>
              {template.variables && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Variables: {template.variables.length}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {template.variables.slice(0, 3).map(variable => (
                      <span key={variable} className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {variable}
                      </span>
                    ))}
                    {template.variables.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{template.variables.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
              <Button 
                onClick={() => onSelectTemplate(template)}
                className="w-full"
              >
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-500">
            Try adjusting your search or category filter
          </p>
        </div>
      )}
    </div>
  );
}