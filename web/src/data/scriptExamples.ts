export interface Example {
  id: string;
  title: string;
  description: string;
  code: string;
  target: 'pre' | 'post' | 'both';
  category: string;
}

export const EXAMPLES: Example[] = [
  // Random Data Tokens
  {
    id: 'random-tokens-reference',
    category: 'Random Data',
    title: 'Random Data Tokens Reference',
    description: 'Use {{$randomXxx}} tokens in URL, params, headers, or body to inject realistic fake data. Each send generates fresh values. Perfect for testing with realistic data without hardcoding. Tokens work in templates: {{$randomEmail}}, {{$randomUUID}}, {{$timestamp}}, etc.',
    target: 'both',
    code: `// Use random data tokens in URL, params, headers, or body
// Each {{$randomXxx}} generates a fresh value on every send

// IDs & Identification
{{$randomUUID}}        // e.g. 550e8400-e29b-41d4-a716-446655440000
{{$guid}}              // alias for $randomUUID
{{$timestamp}}         // e.g. 1713177600 (Unix seconds)
{{$isoTimestamp}}      // e.g. 2024-04-15T12:00:00.000Z

// Names & People
{{$randomFirstName}}   // e.g. John
{{$randomLastName}}    // e.g. Doe
{{$randomFullName}}    // e.g. John Doe
{{$randomUserName}}    // e.g. john_doe42
{{$randomJobTitle}}    // e.g. Product Manager
{{$randomCompanyName}} // e.g. ACME Corp

// Contact & Web
{{$randomEmail}}       // e.g. john@example.com
{{$randomPhoneNumber}} // e.g. (555) 123-4567
{{$randomUrl}}         // e.g. https://example.com/image
{{$randomDomainName}}  // e.g. example.com
{{$randomPassword}}    // e.g. mK9$vL2@xQ

// Network
{{$randomIP}}          // e.g. 192.168.1.1
{{$randomIPV6}}        // e.g. 2001:0db8::1
{{$randomMACAddress}}  // e.g. 00:1A:2B:3C:4D:5E

// Numbers & Colors
{{$randomInt}}         // e.g. 543 (0-1000)
{{$randomFloat}}       // e.g. 123.45
{{$randomColor}}       // e.g. red
{{$randomHexColor}}    // e.g. #FF5733

// Text & Lorem
{{$randomLoremWord}}       // e.g. lorem
{{$randomLoremSentence}}   // e.g. Lorem ipsum dolor sit amet
{{$randomLoremParagraph}}  // longer paragraph

// Location
{{$randomCity}}        // e.g. San Francisco
{{$randomCountry}}     // e.g. United States
{{$randomStreetAddress}} // e.g. 123 Main St
{{$randomZipCode}}     // e.g. 94105

// Example URL with multiple tokens:
// https://api.example.com/users?id={{$randomUUID}}&created={{$timestamp}}
//
// Example JSON body:
// {
//   "id": "{{$randomUUID}}",
//   "name": "{{$randomFullName}}",
//   "email": "{{$randomEmail}}",
//   "phone": "{{$randomPhoneNumber}}",
//   "registered_at": "{{$isoTimestamp}}"
// }`,
  },

  // Tests
  {
    id: 'test-status',
    category: 'Tests',
    title: 'Status Code Assertion',
    description: 'Verify the HTTP response status matches expectations. Check for 200 (success), 404 (not found), 500 (server error), etc. This is the most basic test—if status is wrong, the request failed.',
    target: 'post',
    code: `test('Status is 200', () => {
  if (response.status !== 200) {
    throw new Error(\`Expected status 200, got \${response.status}\`);
  }
});`,
  },
  {
    id: 'test-json-field',
    category: 'Tests',
    title: 'JSON Body Field Check',
    description: 'Verify that the response JSON contains a field with the correct type and value. Parse response.body, check field existence, and validate type (string, number, object, etc.). Essential for ensuring APIs return the right data structure.',
    target: 'post',
    code: `test('Response contains userId', () => {
  const body = JSON.parse(response.body);
  if (!body.userId) {
    throw new Error('userId field is missing');
  }
  if (typeof body.userId !== 'number') {
    throw new Error('userId must be a number');
  }
});`,
  },
  {
    id: 'test-response-time',
    category: 'Tests',
    title: 'Response Time Assertion',
    description: 'Check that the API responds within a performance threshold (milliseconds). Useful for catching slowdowns or detecting N+1 query problems. response.time contains the round-trip time in ms.',
    target: 'post',
    code: `test('Response time under 500ms', () => {
  if (response.time > 500) {
    throw new Warn(\`Response took \${response.time}ms, expected < 500ms\`);
  }
});`,
  },
  {
    id: 'test-array-length',
    category: 'Tests',
    title: 'Array Length Check',
    description: 'Verify that list/array endpoints return data. Check if response contains an array, validate it\'s not empty, and optionally check length matches pagination parameters. Common for /list, /search, /filter endpoints.',
    target: 'post',
    code: `test('Response contains items', () => {
  const body = JSON.parse(response.body);
  if (!Array.isArray(body.items)) {
    throw new Error('items is not an array');
  }
  if (body.items.length === 0) {
    throw new Error('items array is empty');
  }
});`,
  },
  {
    id: 'test-schema',
    category: 'Tests',
    title: 'Schema Validation',
    description: 'Ensure the response JSON has all required fields in the correct structure. Loop through a list of required field names and throw an error if any are missing. Protects against API breaking changes.',
    target: 'post',
    code: `test('Response schema is valid', () => {
  const body = JSON.parse(response.body);
  const required = ['id', 'name', 'email', 'createdAt'];
  const missing = required.filter(field => !(field in body));
  if (missing.length > 0) {
    throw new Error(\`Missing required fields: \${missing.join(', ')}\`);
  }
});`,
  },

  // Environment Variables
  {
    id: 'env-capture-token',
    category: 'Environment',
    title: 'Capture Auth Token from Response',
    description: 'After login succeeds, extract the auth token from the response and save it to env.authToken. Future requests can read env.authToken to add the Authorization header automatically. This enables request chaining and workflow testing.',
    target: 'post',
    code: `// After login response, save the token for next requests
const body = JSON.parse(response.body);
if (body.token) {
  env.set('authToken', body.token);
  console.log('[info] Token saved to env.authToken');
} else {
  console.log('[warn] No token in response');
}`,
  },
  {
    id: 'env-capture-id',
    category: 'Environment',
    title: 'Extract ID from Response',
    description: 'After creating a resource (POST), capture its ID from the response and save to environment. Use this ID in subsequent GET/PUT/DELETE requests. Common pattern: Create → Read → Update → Delete (CRUD workflow).',
    target: 'post',
    code: `// After creating a resource, save its ID for updates/deletes
const body = JSON.parse(response.body);
if (body.data && body.data.id) {
  env.set('resourceId', String(body.data.id));
  console.log('[info] Resource ID saved: ' + body.data.id);
}`,
  },
  {
    id: 'env-dynamic-timestamp',
    category: 'Environment',
    title: 'Generate Dynamic Timestamp',
    description: 'Generate a fresh timestamp before each request. Useful for APIs requiring timestamps in headers or query parameters, or for testing time-based features. Generates both Unix milliseconds and ISO 8601 format.',
    target: 'pre',
    code: `// Generate a timestamp for the current request
const now = Date.now();
env.set('timestamp', String(now));
env.set('timestampISO', new Date().toISOString());

// Optionally add to request headers
request.headers.push({
  key: 'X-Request-Time',
  value: String(now),
  enabled: true
});`,
  },
  {
    id: 'env-generate-uuid',
    category: 'Environment',
    title: 'Generate UUID',
    description: 'Generate a UUID v4 before each request for correlation IDs, idempotency keys, or request tracing. Each request gets a unique ID for logging and debugging workflows. Store in environment for reuse across multiple headers.',
    target: 'pre',
    code: `// Generate a UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const requestId = uuidv4();
env.set('requestId', requestId);
env.set('correlationId', requestId);`,
  },
  {
    id: 'env-set-multiple',
    category: 'Environment',
    title: 'Store Multiple Values from Response',
    description: 'Batch-save multiple fields from a response to environment variables in a single loop. Reduces boilerplate for complex responses and makes it easy to reference any field in future requests.',
    target: 'post',
    code: `// Save multiple values from response in one batch
const body = JSON.parse(response.body);
const toStore = {
  userId: body.user.id,
  userName: body.user.name,
  apiKey: body.credentials.apiKey,
  expiresAt: body.credentials.expiresAt,
};

Object.entries(toStore).forEach(([key, value]) => {
  env.set(key, String(value));
});

console.log('[info] Stored ' + Object.keys(toStore).length + ' values to env');`,
  },

  // Secrets
  {
    id: 'secrets-read-api-key',
    category: 'Secrets',
    title: 'Read a Secret in a Pre-Request Script',
    description: 'Retrieve a secret value (local only, never exported) and inject it as a request header. Ideal for API keys and tokens you never want to include in exports or share with teammates.',
    target: 'pre',
    code: `// Inject a secret API key as a header
const apiKey = env.secret.get('API_KEY');
if (!apiKey) {
  console.warn('[warn] API_KEY secret not set — request may fail');
}

request.headers['X-Api-Key'] = apiKey ?? '';`,
  },
  {
    id: 'secrets-store-after-login',
    category: 'Secrets',
    title: 'Store a Token as a Secret After Login',
    description: 'After a login request succeeds, save the returned token to the secret store instead of an environment variable. Secrets are local-only — they are never included in exports, making them safe for sensitive credentials.',
    target: 'post',
    code: `// Store the access token as a secret after login
const body = JSON.parse(response.body);
const token = body.access_token;
if (token) {
  env.secret.set('ACCESS_TOKEN', token);
  console.log('[info] Access token saved to secrets');
} else {
  console.error('[error] No access_token in response');
}`,
  },
  {
    id: 'secrets-rotate-token',
    category: 'Secrets',
    title: 'Rotate / Remove an Expired Secret',
    description: 'When a token expires or needs to be refreshed, unset the old secret first, then store the replacement. Using env.secret.unset ensures the old value is fully removed before the new one is written.',
    target: 'post',
    code: `// Replace an expiring token with a fresh one
const body = JSON.parse(response.body);
if (body.access_token) {
  env.secret.unset('ACCESS_TOKEN');      // clear the old token
  env.secret.set('ACCESS_TOKEN', body.access_token);
  if (body.refresh_token) {
    env.secret.set('REFRESH_TOKEN', body.refresh_token);
  }
  console.log('[info] Tokens rotated successfully');
}`,
  },
  {
    id: 'secrets-vs-env',
    category: 'Secrets',
    title: 'Secrets vs Environment Variables',
    description: 'Choose between secrets and env vars based on sensitivity. Use env.secret for credentials and tokens that must never leave the machine. Use env.set for non-sensitive data like base URLs and user IDs that teammates can share.',
    target: 'both',
    code: `// Secrets: local-only, never exported
//   Use for: API keys, passwords, tokens, private keys
env.secret.set('API_KEY', 'sk-...');
const apiKey = env.secret.get('API_KEY');

// Env vars: shared with teammates via export/import
//   Use for: base URLs, user IDs, feature flags
env.set('BASE_URL', 'https://api.example.com');
env.set('USER_ID', '42');

console.log('[info] API key is a secret:', apiKey ? '✓ set' : '✗ missing');
console.log('[info] Base URL from env:', env.get('BASE_URL'));`,
  },

  // Authentication
  {
    id: 'auth-bearer-token',
    category: 'Auth',
    title: 'Add Bearer Token Header',
    description: 'Read the authToken from environment (saved by a login request) and add it as an Authorization header. This is the standard pattern for OAuth 2.0 and JWT-based APIs. Allows request workflows without hardcoding tokens.',
    target: 'pre',
    code: `// Add Authorization header with token from environment
const token = env.get('authToken');
if (token) {
  request.headers.push({
    key: 'Authorization',
    value: 'Bearer ' + token,
    enabled: true
  });
  console.log('[info] Added Bearer token');
} else {
  console.log('[warn] No authToken found in environment');
}`,
  },
  {
    id: 'auth-basic',
    category: 'Auth',
    title: 'Basic Authentication',
    description: 'Encode username and password in Base64 and send as Authorization header. Use for APIs that support HTTP Basic auth. Less secure than Bearer tokens but still widely used for legacy systems.',
    target: 'pre',
    code: `// Basic authentication (username:password in Base64)
const username = 'user@example.com';
const password = 'secretpassword';
const credentials = btoa(username + ':' + password);

request.headers.push({
  key: 'Authorization',
  value: 'Basic ' + credentials,
  enabled: true
});`,
  },
  {
    id: 'auth-custom-header',
    category: 'Auth',
    title: 'Custom API Key Header',
    description: 'Add a vendor-specific API key header (X-API-Key, X-Auth-Token, etc.). Many SaaS APIs use custom headers instead of Bearer tokens. Store the key in environment for safe, reusable access across requests.',
    target: 'pre',
    code: `// Custom API key authentication
const apiKey = env.get('apiKey');
if (!apiKey) {
  throw new Error('apiKey not set in environment');
}

request.headers.push({
  key: 'X-API-Key',
  value: apiKey,
  enabled: true
});`,
  },
  {
    id: 'auth-hmac',
    category: 'Auth',
    title: 'HMAC Signature (Advanced)',
    description: 'Generate a cryptographic signature to prove request authenticity. Some APIs (AWS, Stripe, webhooks) require HMAC signatures. This example shows the pattern; your API docs will specify the signing algorithm.',
    target: 'pre',
    code: `// HMAC signature (requires secret key)
// Note: This is a simplified example; full HMAC requires crypto library
const secret = env.get('hmacSecret');
if (!secret) {
  throw new Error('hmacSecret not configured');
}

// For actual HMAC-SHA256, use your backend to sign
// Or use a simple timestamp-based signature
const timestamp = Date.now();
const signature = 'mock-signature-' + timestamp;

request.headers.push({
  key: 'X-Signature',
  value: signature,
  enabled: true
});
request.headers.push({
  key: 'X-Timestamp',
  value: String(timestamp),
  enabled: true
});`,
  },

  // Request Manipulation
  {
    id: 'req-inject-headers',
    category: 'Request',
    title: 'Inject Dynamic Headers',
    description: 'Automatically add headers for correlation tracking, versioning, and request metadata. Useful for APIs that require specific headers on every call, or for distributed tracing in microservices.',
    target: 'pre',
    code: `// Inject common headers dynamically
const correlationId = env.get('correlationId');
const now = new Date().toISOString();

request.headers.push(
  {
    key: 'X-Correlation-ID',
    value: correlationId || 'no-id',
    enabled: true
  },
  {
    key: 'X-Request-Date',
    value: now,
    enabled: true
  },
  {
    key: 'X-Client-Version',
    value: '1.0.0',
    enabled: true
  }
);`,
  },
  {
    id: 'req-override-params',
    category: 'Request',
    title: 'Override URL Parameters',
    description: 'Replace query parameters with values from environment. Enables dynamic filtering, pagination, and parameterization without manually editing the URL bar for each request.',
    target: 'pre',
    code: `// Override or add query parameters from environment
const resourceId = env.get('resourceId');
const filter = env.get('filter');

// Clear existing params and set new ones
request.params = [];
if (resourceId) {
  request.params.push({
    key: 'id',
    value: resourceId,
    enabled: true
  });
}
if (filter) {
  request.params.push({
    key: 'filter',
    value: filter,
    enabled: true
  });
}`,
  },
  {
    id: 'req-set-body',
    category: 'Request',
    title: 'Set Request Body Dynamically',
    description: 'Build the request body from environment variables saved by previous requests. Essential for workflows like "create user with token" or "update resource with ID from list response".',
    target: 'pre',
    code: `// Build request body from environment values
const userId = env.get('userId');
const authToken = env.get('authToken');

if (!userId || !authToken) {
  throw new Error('Missing userId or authToken in environment');
}

const payload = {
  userId: userId,
  token: authToken,
  timestamp: Date.now(),
  action: 'update'
};

request.body = JSON.stringify(payload);
request.headers.push({
  key: 'Content-Type',
  value: 'application/json',
  enabled: true
});`,
  },

  // Chaining / Workflows
  {
    id: 'chain-login-flow',
    category: 'Chaining',
    title: 'Login Flow (Pre + Post)',
    description: 'Complete workflow: Login endpoint returns a token. Post-request script captures it and saves to environment. Subsequent requests read this token for authentication. Shows the essence of request chaining.',
    target: 'both',
    code: `// LOGIN REQUEST (Pre-request script)
// Nothing special needed, just send credentials

// LOGIN RESPONSE (Post-request script)
// Capture the token and save for subsequent requests

test('Login successful', () => {
  if (response.status !== 200) {
    throw new Error('Login failed with status ' + response.status);
  }
});

const body = JSON.parse(response.body);
if (body.token) {
  env.set('authToken', body.token);
  env.set('userId', String(body.user.id));
  console.log('[info] Logged in as ' + body.user.name);
}`,
  },
  {
    id: 'chain-pagination',
    category: 'Chaining',
    title: 'Pagination Loop',
    description: 'When listing endpoints return a cursor or nextPage token, extract it in post-request and save to environment. Next request uses this cursor in its query parameters to fetch the next batch of results.',
    target: 'post',
    code: `// After listing response, extract cursor for next page
const body = JSON.parse(response.body);

if (body.pagination && body.pagination.nextCursor) {
  env.set('nextCursor', body.pagination.nextCursor);
  console.log('[info] Next page cursor: ' + body.pagination.nextCursor);
} else {
  console.log('[info] No more pages');
  env.set('nextCursor', '');
}

// For the next request, use:
// URL params: cursor={{nextCursor}}
test('Has items', () => {
  if (!body.items || body.items.length === 0) {
    throw new Error('No items in response');
  }
});`,
  },
  {
    id: 'chain-ref-injection',
    category: 'Chaining',
    title: 'Variable Injection Setup',
    description: 'Extract multiple fields from a response and save to environment. Use the {{variableName}} syntax in the next request\'s URL, params, or body to automatically substitute these values. Enables complex multi-step workflows.',
    target: 'post',
    code: `// Extract data and prepare for template substitution in next request
const body = JSON.parse(response.body);

// Store values that can be used as {{variableName}} in next request URL/params
env.set('lastId', String(body.data.id));
env.set('lastEmail', body.data.email);
env.set('lastStatus', body.data.status);

console.log('[info] Stored values for next request:');
console.log('[debug] lastId = ' + env.get('lastId'));
console.log('[debug] lastEmail = ' + env.get('lastEmail'));

// Use in next request:
// URL: /api/users/{{lastId}}/profile
// or Param: email={{lastEmail}}`,
  },
  {
    id: 'test-explicit-success',
    category: 'Tests',
    title: 'Explicit Success Message',
    description: 'Use throw new Success(...) to show a test passed with a custom message. Useful for detailed results or multi-step validations that succeed. Different from a regular pass — you control the message shown.',
    target: 'post',
    code: `test('Verify user creation flow', () => {
  const body = JSON.parse(response.body);

  if (!body.data || !body.data.id) {
    throw new Error('User ID missing in response');
  }

  if (body.data.email !== 'test@example.com') {
    throw new Error('Email does not match');
  }

  throw new Success(\`User created successfully: ID=\${body.data.id}, email=\${body.data.email}\`);
});`,
  },
  {
    id: 'test-severity-levels',
    category: 'Tests',
    title: 'Test with All Severity Levels',
    description: 'Demonstrates all three severity levels: throw new Error(...) for hard failures (red), throw new Warn(...) for warnings (amber), and throw new Success(...) for explicit success (green). Use these to classify test results by severity.',
    target: 'post',
    code: `test('Check status code', () => {
  if (response.status < 400) {
    throw new Success(\`Request successful: \${response.status}\`);
  }
  throw new Error(\`Request failed: \${response.status}\`);
});

test('Check deprecated headers', () => {
  const headers = response.headers;
  if (headers.some(h => h.key === 'X-Deprecated-Api')) {
    throw new Warn('Response contains deprecated header: X-Deprecated-Api');
  }
});`,
  },
  // Emitter — short-lived values for branch conditions
  {
    id: 'emit-status-ok',
    category: 'Emitter',
    title: 'Emit success flag',
    description: 'Emit a boolean flag based on the response status. Use "Emitted key is truthy" with key isOk in a branch condition to route the automation based on whether this request succeeded.',
    target: 'post',
    code: `// Emit a flag that branch conditions can check
emit('isOk', response.status >= 200 && response.status < 300);`,
  },
  {
    id: 'emit-json-field',
    category: 'Emitter',
    title: 'Emit a JSON field',
    description: 'Parse the response body and emit a specific field value. Use "Emitted equals" with key status and value active in a branch condition to take different paths based on the value.',
    target: 'post',
    code: `// Parse response and emit a field for branching
const body = JSON.parse(response.body);
emit('status', body.status);          // e.g. "active" / "inactive"
emit('userId', String(body.user.id)); // always emit as string`,
  },
  {
    id: 'emit-token-expiry',
    category: 'Emitter',
    title: 'Emit token expiry check',
    description: 'Decode a JWT expiry claim and emit whether the token is expired. Branch on "Emitted key is truthy" with key tokenExpired to conditionally refresh the token before continuing.',
    target: 'post',
    code: `// Check if a JWT in the response is already expired
const body = JSON.parse(response.body);
const token = body.accessToken || env.get('authToken');

if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    emit('tokenExpired', isExpired);
    console.log('[info] Token expires at ' + new Date(payload.exp * 1000).toISOString());
  } catch {
    emit('tokenExpired', true); // treat unparseable token as expired
  }
}`,
  },
  {
    id: 'emit-retry-after',
    category: 'Emitter',
    title: 'Emit rate-limit signal',
    description: 'Detect a 429 Too Many Requests response and emit a flag. Branch on "Emitted key is truthy" with key rateLimited to stop the automation or route to a delay step.',
    target: 'post',
    code: `// Detect rate limiting so a branch can pause or stop
emit('rateLimited', response.status === 429);

if (response.status === 429) {
  const retryAfter = response.headers.find(h => h.key.toLowerCase() === 'retry-after');
  console.log('[warn] Rate limited. Retry-After: ' + (retryAfter?.value ?? 'unknown'));
}`,
  },

  // Utilities — base64 & response headers
  {
    id: 'util-base64-encode',
    category: 'Utilities',
    title: 'Base64 encode a string',
    description: 'Encode any string to Base64 with UTF-8 safety. Plain btoa() only handles Latin-1 — wrap with TextEncoder to support emoji, accents, and other non-ASCII characters. Useful for embedding binary-ish data in headers or query params.',
    target: 'both',
    code: `// UTF-8 safe Base64 encode
function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

const encoded = b64encode('hello world — café 🚀');
console.log(encoded);

// Use in a header
request.headers.push({
  key: 'X-Encoded-Payload',
  value: encoded,
  enabled: true,
});`,
  },
  {
    id: 'util-base64-decode',
    category: 'Utilities',
    title: 'Base64 decode a string',
    description: 'Decode a Base64 string back to UTF-8 text. atob() returns Latin-1 bytes — decode them through TextDecoder to recover the original Unicode string.',
    target: 'both',
    code: `// UTF-8 safe Base64 decode
function b64decode(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const decoded = b64decode('aGVsbG8gd29ybGQ=');
console.log(decoded);`,
  },
  {
    id: 'util-base64-basic-auth',
    category: 'Utilities',
    title: 'Build a Basic auth header',
    description: 'Compose the Authorization header for HTTP Basic auth from username and password pulled from secrets. Base64-encodes "user:pass" and pushes the header onto the outgoing request.',
    target: 'pre',
    code: `// Build Basic auth header from secrets
const username = secrets.get('basicUser');
const password = secrets.get('basicPass');

if (!username || !password) {
  throw new Error('Missing basicUser / basicPass in secrets');
}

const token = btoa(username + ':' + password);
request.headers.push({
  key: 'Authorization',
  value: 'Basic ' + token,
  enabled: true,
});`,
  },
  {
    id: 'util-base64-decode-jwt',
    category: 'Utilities',
    title: 'Decode a JWT payload',
    description: 'Split a JWT, base64url-decode the middle segment, and parse it as JSON. Lets you read claims like sub, exp, scopes. Handles URL-safe characters and missing padding that base64url uses.',
    target: 'post',
    code: `// Decode a JWT payload (base64url → JSON)
function decodeJwt(token) {
  const part = token.split('.')[1] || '';
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + (4 - part.length % 4) % 4, '=');
  return JSON.parse(atob(b64));
}

const body = JSON.parse(response.body);
const token = body.accessToken || env.get('authToken');
if (token) {
  const claims = decodeJwt(token);
  console.log('[info] sub: ' + claims.sub);
  console.log('[info] expires: ' + new Date(claims.exp * 1000).toISOString());
  env.set('tokenSub', claims.sub);
}`,
  },
  {
    id: 'util-parse-url-params',
    category: 'Utilities',
    title: 'Parse query params from a URL',
    description: 'Extract query string parameters from any URL into an object. Uses the built-in URL/URLSearchParams APIs — handles encoding, repeated keys, and missing values. Useful for reading params off a redirect Location header or a callback URL pasted into a secret.',
    target: 'both',
    code: `// Parse query params from a URL string
function parseParams(url) {
  try {
    const sp = new URL(url).searchParams;
    return Object.fromEntries(sp);
  } catch {
    return {};
  }
}

const target = 'https://api.example.com/users?page=2&limit=20&sort=name';
const params = parseParams(target);
console.log(params); // { page: '2', limit: '20', sort: 'name' }

// Repeated keys (?tag=a&tag=b) — use getAll
const sp = new URL(target).searchParams;
const tags = sp.getAll('tag');
console.log('tags: ' + JSON.stringify(tags));

// Common follow-up: persist a value into the env
if (params.page) env.set('lastPage', params.page);`,
  },
  {
    id: 'util-response-header-lookup',
    category: 'Utilities',
    title: 'Read a response header',
    description: 'Case-insensitive lookup of a single response header. response.headers is an array of { key, value } — wrap the find() call so you can call getHeader("content-type") without worrying about casing.',
    target: 'post',
    code: `// Case-insensitive response header lookup
function getHeader(name) {
  const lower = name.toLowerCase();
  return response.headers.find(h => h.key.toLowerCase() === lower)?.value;
}

const contentType = getHeader('content-type');
const requestId   = getHeader('x-request-id');
const etag        = getHeader('etag');

console.log('Content-Type: ' + contentType);
console.log('X-Request-Id: ' + requestId);
console.log('ETag: ' + etag);`,
  },
  {
    id: 'util-response-header-capture',
    category: 'Utilities',
    title: 'Capture response headers to env',
    description: 'Persist headers that change between calls — ETag, Location, X-Request-Id, pagination cursors — into the environment so the next request can reuse them. Skip values that did not come back.',
    target: 'post',
    code: `// Persist useful response headers into the environment
function getHeader(name) {
  const lower = name.toLowerCase();
  return response.headers.find(h => h.key.toLowerCase() === lower)?.value;
}

const etag      = getHeader('etag');
const location  = getHeader('location');
const requestId = getHeader('x-request-id');
const nextPage  = getHeader('x-next-cursor');

if (etag)      env.set('lastETag', etag);
if (location)  env.set('createdLocation', location);
if (requestId) env.set('lastRequestId', requestId);
if (nextPage)  env.set('nextCursor', nextPage);

console.log('[info] saved headers to env');`,
  },
  {
    id: 'util-response-headers-all',
    category: 'Utilities',
    title: 'List all response headers',
    description: 'Dump every header the server returned. Helpful when you are not sure what the API actually sends back — run this once on a sample response to discover header names, then narrow to specific ones with getHeader().',
    target: 'post',
    code: `// Print every response header
console.log('--- Response headers (' + response.headers.length + ') ---');
for (const h of response.headers) {
  console.log(h.key + ': ' + h.value);
}

// Filter a related group (e.g. all rate-limit signals)
const rateLimit = response.headers.filter(h => h.key.toLowerCase().startsWith('x-ratelimit'));
console.log('Rate-limit headers: ' + JSON.stringify(rateLimit));`,
  },
];

export const CATEGORIES: string[] = [
  'Tests',
  'Environment',
  'Secrets',
  'Auth',
  'Request',
  'Chaining',
  'Emitter',
  'Utilities',
];
