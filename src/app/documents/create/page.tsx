'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Save, Upload, ArrowLeft, Plus, 
  FileImage, Loader2, X, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

const PDF_TEMPLATES = [
  { 
    name: 'Blank Document', 
    description: 'Start with a clean professional slate',
    icon: '📄',
    category: 'Basic',
    data: { 
      header: '', 
      content: '<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333; padding: 20px;"><p style="font-size: 16px;">Start writing your professional document content here...</p></div>', 
      footer: '' 
    } 
  },
  { 
    name: 'Business Letter', 
    description: 'Professional correspondence template',
    icon: '✉️',
    category: 'Business',
    data: { 
      header: '<div style="text-align: center; border-bottom: 3px solid #0066cc; padding-bottom: 25px; margin-bottom: 40px;"><h1 style="color: #0066cc; margin: 0; font-size: 24px; font-weight: bold;">COMPANY LETTERHEAD</h1><p style="margin: 8px 0; color: #666; font-size: 14px;">Your Company Address | Phone: (555) 123-4567 | Email: info@company.com</p></div>', 
      content: '<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;"><p style="margin-bottom: 25px; font-size: 16px;"><strong>Date:</strong> ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p><p style="margin-bottom: 25px; font-size: 16px;"><strong>To:</strong><br>[Recipient Name]<br>[Recipient Title]<br>[Company Name]<br>[Address Line 1]<br>[City, State ZIP Code]</p><p style="margin-bottom: 25px; font-size: 16px;"><strong>Dear [Recipient Name],</strong></p><p style="margin-bottom: 25px; font-size: 16px;">I hope this letter finds you well. I am writing to [state the purpose of your letter clearly and professionally].</p><p style="margin-bottom: 25px; font-size: 16px;">[Main content paragraph - provide detailed information, context, or request. Keep it clear, concise, and professional.]</p><p style="margin-bottom: 25px; font-size: 16px;">[Additional paragraph if needed - support your main points with relevant details or next steps.]</p><p style="margin-bottom: 25px; font-size: 16px;">Thank you for your time and consideration. I look forward to your response and to continuing our professional relationship.</p><p style="margin-bottom: 50px; font-size: 16px;">Sincerely,</p><p style="font-size: 16px;"><strong>[Your Full Name]</strong><br>[Your Title]<br>[Your Company]<br>[Your Phone Number]<br>[Your Email Address]</p></div>', 
      footer: '<div style="text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">Page {page} | Confidential Business Communication</div>' 
    } 
  },
  { 
    name: 'Executive Report', 
    description: 'Comprehensive business analysis format',
    icon: '📊',
    category: 'Business',
    data: { 
      header: '<div style="text-align: center; border-bottom: 4px solid #2c5aa0; padding-bottom: 25px; margin-bottom: 40px;"><h1 style="color: #2c5aa0; margin: 0; font-size: 32px; font-weight: bold;">EXECUTIVE REPORT</h1><p style="margin: 15px 0; color: #666; font-size: 16px;">' + new Date().getFullYear() + ' Strategic Business Analysis</p><p style="margin: 5px 0; color: #888; font-size: 14px;">Prepared by: [Your Name] | Date: ' + new Date().toLocaleDateString() + '</p></div>', 
      content: '<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;"><h2 style="color: #2c5aa0; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 22px;">Executive Summary</h2><p style="margin-bottom: 25px; font-size: 16px;">This comprehensive report provides strategic analysis of [subject matter]. Our findings indicate significant opportunities for [key insights]. The analysis covers [time period] and includes [scope of analysis].</p><div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #2c5aa0; margin: 25px 0;"><h4 style="margin: 0 0 10px 0; color: #2c5aa0;">Key Highlights:</h4><ul style="margin: 0; padding-left: 20px;"><li>Revenue growth of [X]% year-over-year</li><li>Market expansion in [specific areas]</li><li>Operational efficiency improvements</li></ul></div><h2 style="color: #2c5aa0; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 22px;">Market Analysis</h2><p style="margin-bottom: 25px; font-size: 16px;">Current market conditions show [analysis]. Industry trends indicate [trends]. Our competitive position remains [position] due to [factors].</p><h2 style="color: #2c5aa0; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 22px;">Financial Performance</h2><p style="margin-bottom: 25px; font-size: 16px;">Financial metrics demonstrate [performance]. Key indicators include [metrics]. Projected growth for next quarter is [projection].</p><h2 style="color: #2c5aa0; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 22px;">Strategic Recommendations</h2><ol style="margin-bottom: 25px; padding-left: 25px; font-size: 16px;"><li style="margin-bottom: 15px;"><strong>Immediate Actions (0-3 months):</strong> [Specific actionable items]</li><li style="margin-bottom: 15px;"><strong>Short-term Goals (3-12 months):</strong> [Strategic initiatives]</li><li style="margin-bottom: 15px;"><strong>Long-term Vision (1-3 years):</strong> [Strategic direction]</li></ol><h2 style="color: #2c5aa0; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 22px;">Conclusion</h2><p style="font-size: 16px;">Based on comprehensive analysis, we recommend immediate implementation of [recommendations]. These strategic initiatives will position us for [expected outcomes] and ensure sustainable growth in [timeframe].</p></div>', 
      footer: '<div style="text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">Confidential Executive Report | Page {page} | © ' + new Date().getFullYear() + '</div>' 
    } 
  },
  { 
    name: 'Professional Invoice', 
    description: 'Detailed billing and payment template',
    icon: '💰',
    category: 'Finance',
    data: { 
      header: '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #28a745; padding-bottom: 25px; margin-bottom: 40px;"><div><h1 style="color: #28a745; margin: 0; font-size: 36px; font-weight: bold;">INVOICE</h1><p style="margin: 5px 0; color: #666; font-size: 14px;">Professional Services</p></div><div style="text-align: right;"><h2 style="margin: 0; color: #333; font-size: 20px;">[Your Company Name]</h2><p style="margin: 5px 0; color: #666; font-size: 14px;">[Your Address]<br>[City, State ZIP]<br>[Phone] | [Email]</p></div></div>', 
      content: '<div style="font-family: Arial, sans-serif; color: #333;"><div style="display: flex; justify-content: space-between; margin-bottom: 40px;"><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; width: 48%;"><h3 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">Invoice Details</h3><p style="margin: 8px 0; font-size: 16px;"><strong>Invoice #:</strong> INV-' + Date.now().toString().slice(-6) + '</p><p style="margin: 8px 0; font-size: 16px;"><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p><p style="margin: 8px 0; font-size: 16px;"><strong>Due Date:</strong> ' + new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString() + '</p><p style="margin: 8px 0; font-size: 16px;"><strong>Terms:</strong> Net 30 Days</p></div><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; width: 48%;"><h3 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">Bill To</h3><p style="margin: 0; font-size: 16px; line-height: 1.6;"><strong>[Client Name]</strong><br>[Client Company]<br>[Address Line 1]<br>[City, State ZIP]<br>[Email Address]<br>[Phone Number]</p></div></div><table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><thead><tr style="background: linear-gradient(135deg, #28a745, #20c997);"><th style="border: none; padding: 15px; text-align: left; color: white; font-size: 16px;">Description</th><th style="border: none; padding: 15px; text-align: center; color: white; font-size: 16px;">Qty</th><th style="border: none; padding: 15px; text-align: right; color: white; font-size: 16px;">Rate</th><th style="border: none; padding: 15px; text-align: right; color: white; font-size: 16px;">Amount</th></tr></thead><tbody><tr style="border-bottom: 1px solid #dee2e6;"><td style="padding: 15px; font-size: 16px;">Professional Consulting Services</td><td style="padding: 15px; text-align: center; font-size: 16px;">10</td><td style="padding: 15px; text-align: right; font-size: 16px;">$150.00</td><td style="padding: 15px; text-align: right; font-size: 16px; font-weight: bold;">$1,500.00</td></tr><tr style="border-bottom: 1px solid #dee2e6;"><td style="padding: 15px; font-size: 16px;">Project Management</td><td style="padding: 15px; text-align: center; font-size: 16px;">5</td><td style="padding: 15px; text-align: right; font-size: 16px;">$200.00</td><td style="padding: 15px; text-align: right; font-size: 16px; font-weight: bold;">$1,000.00</td></tr><tr style="border-bottom: 1px solid #dee2e6;"><td style="padding: 15px; font-size: 16px;">Additional Services</td><td style="padding: 15px; text-align: center; font-size: 16px;">3</td><td style="padding: 15px; text-align: right; font-size: 16px;">$100.00</td><td style="padding: 15px; text-align: right; font-size: 16px; font-weight: bold;">$300.00</td></tr></tbody></table><div style="text-align: right; margin-bottom: 30px; font-size: 18px;"><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; display: inline-block; min-width: 300px;"><p style="margin: 8px 0; display: flex; justify-content: space-between;"><span>Subtotal:</span><strong>$2,800.00</strong></p><p style="margin: 8px 0; display: flex; justify-content: space-between;"><span>Tax (8.5%):</span><strong>$238.00</strong></p><hr style="margin: 15px 0; border: none; border-top: 2px solid #28a745;"><p style="margin: 8px 0; font-size: 22px; display: flex; justify-content: space-between;"><span>Total:</span><strong style="color: #28a745;">$3,038.00</strong></p></div></div><div style="background: linear-gradient(135deg, #e9f7ef, #d4edda); padding: 25px; border-radius: 10px; border-left: 5px solid #28a745;"><h4 style="margin: 0 0 15px 0; color: #28a745; font-size: 18px;">Payment Instructions</h4><p style="margin: 8px 0; font-size: 16px;"><strong>Bank:</strong> [Bank Name]</p><p style="margin: 8px 0; font-size: 16px;"><strong>Account:</strong> [Account Number]</p><p style="margin: 8px 0; font-size: 16px;"><strong>Routing:</strong> [Routing Number]</p><p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">Please include invoice number in payment reference. Late payments may incur 1.5% monthly service charge.</p></div></div>', 
      footer: '<div style="text-align: center; color: #666; font-size: 12px; border-top: 2px solid #28a745; padding-top: 15px;">Thank you for your business! | Questions? Contact us at [email] | Page {page}</div>' 
    } 
  },
  { 
    name: 'Meeting Minutes', 
    description: 'Professional meeting documentation',
    icon: '📝',
    category: 'Business',
    data: { 
      header: '<div style="text-align: center; border-bottom: 3px solid #6c757d; padding-bottom: 25px; margin-bottom: 40px;"><h1 style="color: #6c757d; margin: 0; font-size: 28px; font-weight: bold;">MEETING MINUTES</h1><p style="margin: 15px 0; color: #666; font-size: 16px;">' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</p></div>', 
      content: '<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;"><div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 25px; border-radius: 10px; margin-bottom: 30px; border-left: 5px solid #6c757d;"><h3 style="margin: 0 0 20px 0; color: #6c757d; font-size: 20px;">Meeting Information</h3><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;"><div><p style="margin: 8px 0; font-size: 16px;"><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p><p style="margin: 8px 0; font-size: 16px;"><strong>Time:</strong> [Start Time] - [End Time]</p><p style="margin: 8px 0; font-size: 16px;"><strong>Duration:</strong> [Duration]</p></div><div><p style="margin: 8px 0; font-size: 16px;"><strong>Location:</strong> [Meeting Room/Platform]</p><p style="margin: 8px 0; font-size: 16px;"><strong>Meeting Type:</strong> [Regular/Special/Emergency]</p><p style="margin: 8px 0; font-size: 16px;"><strong>Chair:</strong> [Meeting Chairperson]</p></div></div></div><h3 style="color: #6c757d; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">Attendees</h3><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;"><div><h4 style="color: #6c757d; margin-bottom: 15px;">Present:</h4><ul style="margin: 0; padding-left: 20px; font-size: 16px;"><li style="margin-bottom: 8px;">[Name] - [Title/Department]</li><li style="margin-bottom: 8px;">[Name] - [Title/Department]</li><li style="margin-bottom: 8px;">[Name] - [Title/Department]</li></ul></div><div><h4 style="color: #6c757d; margin-bottom: 15px;">Absent:</h4><ul style="margin: 0; padding-left: 20px; font-size: 16px;"><li style="margin-bottom: 8px;">[Name] - [Reason]</li><li style="margin-bottom: 8px;">[Name] - [Reason]</li></ul></div></div><h3 style="color: #6c757d; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">Agenda Items & Discussions</h3><div style="margin-bottom: 30px;"><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #6c757d;"><h4 style="margin: 0 0 15px 0; color: #6c757d;">1. [Agenda Item Title]</h4><p style="margin: 10px 0; font-size: 16px;"><strong>Discussion:</strong> [Key points discussed, concerns raised, opinions shared]</p><p style="margin: 10px 0; font-size: 16px;"><strong>Decision:</strong> [Final decision or outcome]</p></div><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #6c757d;"><h4 style="margin: 0 0 15px 0; color: #6c757d;">2. [Agenda Item Title]</h4><p style="margin: 10px 0; font-size: 16px;"><strong>Discussion:</strong> [Key points discussed, concerns raised, opinions shared]</p><p style="margin: 10px 0; font-size: 16px;"><strong>Decision:</strong> [Final decision or outcome]</p></div></div><h3 style="color: #6c757d; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">Action Items</h3><table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><thead><tr style="background: #6c757d;"><th style="border: none; padding: 15px; text-align: left; color: white; font-size: 16px;">Action Item</th><th style="border: none; padding: 15px; text-align: left; color: white; font-size: 16px;">Assigned To</th><th style="border: none; padding: 15px; text-align: left; color: white; font-size: 16px;">Due Date</th><th style="border: none; padding: 15px; text-align: left; color: white; font-size: 16px;">Priority</th></tr></thead><tbody><tr style="border-bottom: 1px solid #dee2e6;"><td style="padding: 15px; font-size: 16px;">[Action description]</td><td style="padding: 15px; font-size: 16px;">[Person name]</td><td style="padding: 15px; font-size: 16px;">[Date]</td><td style="padding: 15px; font-size: 16px;"><span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">High</span></td></tr><tr style="border-bottom: 1px solid #dee2e6;"><td style="padding: 15px; font-size: 16px;">[Action description]</td><td style="padding: 15px; font-size: 16px;">[Person name]</td><td style="padding: 15px; font-size: 16px;">[Date]</td><td style="padding: 15px; font-size: 16px;"><span style="background: #ffc107; color: black; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Medium</span></td></tr></tbody></table><div style="background: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc;"><h4 style="margin: 0 0 15px 0; color: #0066cc;">Next Meeting</h4><p style="margin: 5px 0; font-size: 16px;"><strong>Date:</strong> [Next meeting date]</p><p style="margin: 5px 0; font-size: 16px;"><strong>Time:</strong> [Time]</p><p style="margin: 5px 0; font-size: 16px;"><strong>Location:</strong> [Location/Platform]</p><p style="margin: 5px 0; font-size: 16px;"><strong>Agenda:</strong> [Preliminary agenda items]</p></div></div>', 
      footer: '<div style="text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px;">Meeting Minutes | Page {page} | Confidential</div>' 
    } 
  },
  { 
    name: 'Contract Agreement', 
    description: 'Legal document and service agreement',
    icon: '📋',
    category: 'Legal',
    data: { 
      header: '<div style="text-align: center; border-bottom: 4px solid #dc3545; padding-bottom: 25px; margin-bottom: 40px;"><h1 style="color: #dc3545; margin: 0; font-size: 32px; font-weight: bold;">SERVICE AGREEMENT</h1><p style="margin: 15px 0; color: #666; font-size: 16px;">Professional Services Contract</p><p style="margin: 5px 0; color: #888; font-size: 14px;">Agreement Date: ' + new Date().toLocaleDateString() + '</p></div>', 
      content: '<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;"><p style="margin-bottom: 30px; font-size: 16px; text-align: justify;">This Service Agreement ("Agreement") is entered into on <strong>' + new Date().toLocaleDateString() + '</strong> ("Effective Date") between the parties identified below:</p><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;"><div style="background: #fff5f5; padding: 25px; border-radius: 10px; border-left: 5px solid #dc3545;"><h4 style="margin: 0 0 20px 0; color: #dc3545; font-size: 18px;">Service Provider</h4><p style="margin: 8px 0; font-size: 16px;"><strong>[Company/Individual Name]</strong></p><p style="margin: 5px 0; font-size: 14px; line-height: 1.6;">[Business Address]<br>[City, State ZIP Code]<br>[Phone Number]<br>[Email Address]<br>[Business License #]</p></div><div style="background: #fff5f5; padding: 25px; border-radius: 10px; border-left: 5px solid #dc3545;"><h4 style="margin: 0 0 20px 0; color: #dc3545; font-size: 18px;">Client</h4><p style="margin: 8px 0; font-size: 16px;"><strong>[Client Name/Company]</strong></p><p style="margin: 5px 0; font-size: 14px; line-height: 1.6;">[Client Address]<br>[City, State ZIP Code]<br>[Phone Number]<br>[Email Address]</p></div></div><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">1. Scope of Services</h3><p style="margin-bottom: 20px; font-size: 16px; text-align: justify;">The Service Provider agrees to provide the following professional services:</p><ul style="margin-bottom: 25px; padding-left: 25px; font-size: 16px;"><li style="margin-bottom: 10px;">[Detailed description of service 1]</li><li style="margin-bottom: 10px;">[Detailed description of service 2]</li><li style="margin-bottom: 10px;">[Detailed description of service 3]</li></ul><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">2. Terms and Duration</h3><p style="margin-bottom: 25px; font-size: 16px; text-align: justify;">This agreement shall commence on <strong>[Start Date]</strong> and continue until <strong>[End Date]</strong>, unless terminated earlier in accordance with the terms herein. The agreement may be renewed by mutual written consent of both parties.</p><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">3. Compensation and Payment Terms</h3><div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;"><p style="margin: 10px 0; font-size: 16px;"><strong>Total Contract Value:</strong> $[Amount]</p><p style="margin: 10px 0; font-size: 16px;"><strong>Payment Schedule:</strong> [Monthly/Quarterly/Upon completion]</p><p style="margin: 10px 0; font-size: 16px;"><strong>Payment Terms:</strong> Net [30] days from invoice date</p><p style="margin: 10px 0; font-size: 16px;"><strong>Late Payment:</strong> 1.5% monthly service charge on overdue amounts</p></div><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">4. Confidentiality</h3><p style="margin-bottom: 25px; font-size: 16px; text-align: justify;">Both parties acknowledge that they may have access to confidential information. Each party agrees to maintain strict confidentiality and not disclose any proprietary information to third parties without written consent.</p><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">5. Termination</h3><p style="margin-bottom: 25px; font-size: 16px; text-align: justify;">Either party may terminate this agreement with [30] days written notice. Upon termination, all outstanding payments shall become due, and both parties shall return any confidential materials.</p><h3 style="color: #dc3545; border-bottom: 2px solid #ddd; padding-bottom: 8px; margin-bottom: 20px; font-size: 20px;">6. Governing Law</h3><p style="margin-bottom: 40px; font-size: 16px; text-align: justify;">This agreement shall be governed by the laws of [State/Province] and any disputes shall be resolved through binding arbitration.</p><div style="margin-top: 60px;"><table style="width: 100%; border-collapse: collapse;"><tr><td style="width: 50%; padding: 30px 20px; text-align: center; border-top: 2px solid #333; vertical-align: top;"><div style="margin-bottom: 40px;"><strong style="font-size: 16px;">SERVICE PROVIDER</strong></div><div style="margin-bottom: 15px;">_________________________________</div><div style="font-size: 14px; color: #666;"><strong>[Name]</strong><br>[Title]<br>Date: _______________</div></td><td style="width: 50%; padding: 30px 20px; text-align: center; border-top: 2px solid #333; vertical-align: top;"><div style="margin-bottom: 40px;"><strong style="font-size: 16px;">CLIENT</strong></div><div style="margin-bottom: 15px;">_________________________________</div><div style="font-size: 14px; color: #666;"><strong>[Name]</strong><br>[Title]<br>Date: _______________</div></td></tr></table></div></div>', 
      footer: '<div style="text-align: center; color: #666; font-size: 12px; border-top: 2px solid #dc3545; padding-top: 15px;">Legal Document | Page {page} | Confidential Agreement</div>' 
    } 
  }
];

export default function CreateDocumentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    template: 'Blank Document'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateDocument = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      
      // Get template data
      const selectedTemplate = PDF_TEMPLATES.find(t => t.name === formData.template);
      const editorState = selectedTemplate?.data || { header: '', content: '', footer: '' };

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          type: 'pdf',
          description: formData.description,
          editorState
        })
      });

      if (response.ok) {
        const document = await response.json();
        toast.success('Document created successfully');
        router.push(`/documents/${document.id}/edit`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create document');
      }
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('Failed to create document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const uploadResult = await response.json();
        
        const docResponse = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: file.name.replace(/\.[^/.]+$/, ''),
            type: 'pdf',
            fileUrl: uploadResult.url,
            description: 'Uploaded PDF file'
          })
        });

        if (docResponse.ok) {
          const document = await docResponse.json();
          toast.success('PDF uploaded successfully');
          router.push(`/documents/${document.id}`);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTemplate = PDF_TEMPLATES.find(t => t.name === formData.template);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Professional PDF Document</h1>
            <p className="text-gray-600 text-lg mt-1">Choose from professional templates or upload an existing PDF file</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document Creation Form */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Plus className="h-6 w-6" />
                  </div>
                  Create Professional PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div>
                  <Label htmlFor="title" className="text-base font-semibold">Document Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter professional document title..."
                    className="mt-2 h-12 text-lg"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-base font-semibold">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of the document purpose and content..."
                    className="mt-2"
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold mb-4 block">Choose Professional Template</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PDF_TEMPLATES.map((template) => (
                      <div
                        key={template.name}
                        className={`relative p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          formData.template === template.name
                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                        onClick={() => handleInputChange('template', template.name)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-3xl">{template.icon}</div>
                          <div className="flex-1">
                            <div className={`font-semibold text-base mb-2 ${
                              formData.template === template.name ? 'text-blue-700' : 'text-gray-900'
                            }`}>{template.name}</div>
                            <div className="text-sm text-gray-600 leading-relaxed mb-2">{template.description}</div>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          {formData.template === template.name && (
                            <div className="absolute top-3 right-3 text-blue-500">
                              <CheckCircle className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <Button 
                    onClick={handleCreateDocument}
                    disabled={!formData.title.trim() || isLoading}
                    className="w-full h-12 text-lg font-semibold"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                        Creating Professional Document...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5 mr-3" />
                        Create Professional PDF Document
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Upload Option */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Upload className="h-6 w-6" />
                  </div>
                  Upload Existing PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition-colors">
                  <FileImage className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Professional PDF</h3>
                  <p className="text-gray-600 mb-6">
                    Upload existing PDF documents to your secure document library
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="h-12 px-8"
                  >
                    <Upload className="h-5 w-5 mr-3" />
                    Choose PDF File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-4">
                    Supported: PDF files only (Maximum 10MB)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview/Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6 shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
                <CardTitle className="text-xl">Document Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {selectedTemplate && (
                  <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-red-100 rounded-xl">
                        <FileText className="h-8 w-8 text-red-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-lg">PDF Document</div>
                        <div className="text-sm text-gray-500">Professional PDF format</div>
                      </div>
                    </div>
                    
                    {formData.title && (
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-gray-700 mb-1">Title:</div>
                        <div className="text-sm text-gray-900 font-medium">{formData.title}</div>
                      </div>
                    )}
                    
                    {formData.description && (
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-gray-700 mb-1">Description:</div>
                        <div className="text-sm text-gray-900">{formData.description}</div>
                      </div>
                    )}
                    
                    <div className="mb-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Template:</div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{selectedTemplate.icon}</span>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {selectedTemplate.name}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{selectedTemplate.description}</div>
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        Created by: <span className="font-medium">{user?.name || user?.email}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    onClick={() => router.push('/documents')}
                    className="w-full h-11"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}