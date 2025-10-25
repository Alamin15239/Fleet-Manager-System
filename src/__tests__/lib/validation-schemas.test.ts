import { loginSchema, truckSchema, tireSchema } from '@/lib/validation-schemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = { email: 'test@example.com', password: 'password123' };
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const data = { email: 'invalid-email', password: 'password123' };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    it('should reject short password', () => {
      const data = { email: 'test@example.com', password: '12345' };
      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  describe('truckSchema', () => {
    it('should validate correct truck data', () => {
      const data = {
        vin: '1HGBH41JXMN109186',
        make: 'Ford',
        model: 'F-150',
        year: 2023,
        licensePlate: 'ABC123',
        currentMileage: 50000,
      };
      expect(() => truckSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid VIN length', () => {
      const data = {
        vin: '123',
        make: 'Ford',
        model: 'F-150',
        year: 2023,
        licensePlate: 'ABC123',
        currentMileage: 50000,
      };
      expect(() => truckSchema.parse(data)).toThrow();
    });
  });

  describe('tireSchema', () => {
    it('should validate correct tire data', () => {
      const data = {
        tireSize: '275/70R18',
        manufacturer: 'Michelin',
        origin: 'USA',
        quantity: 4,
      };
      expect(() => tireSchema.parse(data)).not.toThrow();
    });

    it('should reject negative quantity', () => {
      const data = {
        tireSize: '275/70R18',
        manufacturer: 'Michelin',
        origin: 'USA',
        quantity: -1,
      };
      expect(() => tireSchema.parse(data)).toThrow();
    });
  });
});
