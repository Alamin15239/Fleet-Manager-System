jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
}))

import { createOrganizationObjectKey, isOrganizationObjectKey } from '@/lib/object-storage'

describe('organization-scoped object storage keys', () => {
  it('accepts an object key only for its exact organization prefix', () => {
    const key = 'organizations/org-alpha/vehicle-documents/truck-1/document.pdf'

    expect(isOrganizationObjectKey(key, 'org-alpha')).toBe(true)
    expect(isOrganizationObjectKey(key, 'org-beta')).toBe(false)
  })

  it('does not accept a neighboring organization prefix', () => {
    const key = 'organizations/org-alpha-evil/vehicle-documents/truck-1/document.pdf'

    expect(isOrganizationObjectKey(key, 'org-alpha')).toBe(false)
  })

  it('rejects missing, malformed, and non-organization keys', () => {
    expect(isOrganizationObjectKey(null, 'org-alpha')).toBe(false)
    expect(isOrganizationObjectKey(undefined, 'org-alpha')).toBe(false)
    expect(isOrganizationObjectKey('public/document.pdf', 'org-alpha')).toBe(false)
    expect(isOrganizationObjectKey('organizations/org-alpha/document.pdf', null)).toBe(false)
  })

  it('creates keys under the normalized organization and module segments', () => {
    const key = createOrganizationObjectKey({
      organizationId: 'Org Alpha',
      module: 'vehicle documents',
      entityId: 'truck/1',
      fileName: 'registration.PDF',
    })

    expect(key).toMatch(/^organizations\/Org-Alpha\/vehicle-documents\/truck-1\/[0-9a-f-]+\.pdf$/i)
    expect(isOrganizationObjectKey(key, 'Org Alpha')).toBe(true)
    expect(isOrganizationObjectKey(key, 'Org Beta')).toBe(false)
  })

  it('rejects invalid organization path segments when creating keys', () => {
    expect(() => createOrganizationObjectKey({
      organizationId: '..',
      module: 'vehicle-documents',
      entityId: 'truck-1',
      fileName: 'document.pdf',
    })).toThrow('Invalid object storage path segment')
  })
})
