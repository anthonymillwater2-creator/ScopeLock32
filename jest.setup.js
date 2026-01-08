// jest.setup.js
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/scopelock-test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'password';
process.env.SMTP_FROM = 'test@test.com';
