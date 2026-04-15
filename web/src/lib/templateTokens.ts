/** Faker-based template tokens for request builders */

export interface TemplateToken {
  name: string;
  detail: string;
  example?: string;
}

export const FAKER_TOKENS: TemplateToken[] = [
  // IDs & Timestamps
  { name: '$randomUUID', detail: 'UUID v4', example: '550e8400-e29b-41d4-a716-446655440000' },
  { name: '$guid', detail: 'Alias for $randomUUID' },
  { name: '$timestamp', detail: 'Unix timestamp (seconds)', example: '1713177600' },
  { name: '$isoTimestamp', detail: 'ISO 8601 timestamp', example: '2024-04-15T12:00:00Z' },

  // Names & People
  { name: '$randomFirstName', detail: 'First name', example: 'John' },
  { name: '$randomLastName', detail: 'Last name', example: 'Doe' },
  { name: '$randomFullName', detail: 'Full name', example: 'John Doe' },
  { name: '$randomUserName', detail: 'Username', example: 'john_doe42' },
  { name: '$randomJobTitle', detail: 'Job title', example: 'Product Manager' },
  { name: '$randomCompanyName', detail: 'Company name', example: 'ACME Corp' },

  // Contact & Web
  { name: '$randomEmail', detail: 'Email address', example: 'john@example.com' },
  { name: '$randomPhoneNumber', detail: 'Phone number', example: '(555) 123-4567' },
  { name: '$randomUrl', detail: 'Image URL' },
  { name: '$randomDomainName', detail: 'Domain name', example: 'example.com' },
  { name: '$randomPassword', detail: 'Strong password' },

  // Network
  { name: '$randomIP', detail: 'IPv4 address', example: '192.168.1.1' },
  { name: '$randomIPV6', detail: 'IPv6 address', example: '2001:0db8::1' },
  { name: '$randomMACAddress', detail: 'MAC address', example: '00:1A:2B:3C:4D:5E' },

  // Numbers & Colors
  { name: '$randomInt', detail: 'Integer (0-1000)', example: '543' },
  { name: '$randomFloat', detail: 'Float (0-1000)', example: '123.45' },
  { name: '$randomColor', detail: 'Color name', example: 'red' },
  { name: '$randomHexColor', detail: 'Hex color', example: '#FF5733' },

  // Text & Lorem
  { name: '$randomLoremWord', detail: 'Lorem word', example: 'lorem' },
  { name: '$randomLoremSentence', detail: 'Lorem sentence', example: 'Lorem ipsum dolor sit amet' },
  { name: '$randomLoremParagraph', detail: 'Lorem paragraph' },

  // Location
  { name: '$randomCity', detail: 'City name', example: 'San Francisco' },
  { name: '$randomCountry', detail: 'Country name', example: 'United States' },
  { name: '$randomStreetAddress', detail: 'Street address', example: '123 Main St' },
  { name: '$randomZipCode', detail: 'ZIP code', example: '94105' },
];
