import { headers } from 'next/headers';
import { ConnectClient } from './client';

// This should be an environment variable in a real application
const TOKEN_VALIDATION_API_URL = 'https://api.example.com/validate-token';

export default async function ConnectPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // "Bearer ".length
  }
  
  return <ConnectClient token={token} validationApiUrl={TOKEN_VALIDATION_API_URL} />;
}
