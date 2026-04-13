import { useState } from 'react';
import styles from './ScriptEditor.module.css';

interface Example {
  id: string;
  title: string;
  description: string;
  code: string;
  target: 'pre' | 'post' | 'both';
  category: string;
}

const EXAMPLES: Example[] = [
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
];

const CATEGORIES = [
  'Tests',
  'Environment',
  'Auth',
  'Request',
  'Chaining',
];

interface ExampleCardProps {
  example: Example;
  onCopy: (code: string, target: 'pre' | 'post') => void;
}

function ExampleCard({ example, onCopy }: ExampleCardProps) {
  const [copied, setCopied] = useState<'pre' | 'post' | null>(null);

  const handleCopy = (target: 'pre' | 'post') => {
    // Check if example can be copied to this target
    if (example.target !== 'both' && example.target !== target) {
      return;
    }

    navigator.clipboard.writeText(example.code).then(() => {
      onCopy(example.code, target);
      setCopied(target);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className={styles.exampleCard}>
      <div className={styles.exampleCardHeader}>
        <h3 className={styles.exampleTitle}>{example.title}</h3>
        <p className={styles.exampleDescription}>{example.description}</p>
      </div>
      <div className={styles.exampleCodeBlock}>
        <pre className={styles.exampleCode}><code>{example.code}</code></pre>
      </div>
      <div className={styles.copyRow}>
        {(example.target === 'pre' || example.target === 'both') && (
          <button
            className={`${styles.copyBtn} ${copied === 'pre' ? styles.copied : ''}`}
            onClick={() => handleCopy('pre')}
            title="Add to Pre-request script"
          >
            {copied === 'pre' ? '✓ Added to Pre' : 'Add to Pre Script'}
          </button>
        )}
        {(example.target === 'post' || example.target === 'both') && (
          <button
            className={`${styles.copyBtn} ${copied === 'post' ? styles.copied : ''}`}
            onClick={() => handleCopy('post')}
            title="Add to Post-request script"
          >
            {copied === 'post' ? '✓ Added to Post' : 'Add to Post Script'}
          </button>
        )}
      </div>
    </div>
  );
}

interface ScriptExamplesProps {
  onCopy: (code: string, target: 'pre' | 'post') => void;
}

export function ScriptExamples({ onCopy }: ScriptExamplesProps) {
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);

  const filtered = EXAMPLES.filter(ex => ex.category === activeCategory);

  return (
    <div className={styles.examplesRoot}>
      <div className={styles.examplesNav}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`${styles.examplesPill} ${activeCategory === cat ? styles.examplesPillActive : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className={styles.examplesBody}>
        {filtered.map(example => (
          <ExampleCard key={example.id} example={example} onCopy={onCopy} />
        ))}
      </div>
    </div>
  );
}
