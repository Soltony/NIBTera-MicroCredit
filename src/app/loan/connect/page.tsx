import { headers } from 'next/headers';
import { ConnectClient } from './client';

// This should be an environment variable in a real application
const TOKEN_VALIDATION_API_URL = 'https://api.example.com/validate-token';
const MOCK_TOKEN_FOR_DEV = 'dev-mode-token';

export default async function ConnectPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // "Bearer ".length
  } else if (process.env.NODE_ENV === 'development') {
    // Fallback for local development when the header is not present
    token = MOCK_TOKEN_FOR_DEV;
  }
  
  return <ConnectClient token={token} validationApiUrl={TOKEN_VALIDATION_API_URL} />;
}
