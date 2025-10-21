
import { headers } from 'next/headers';
import { ConnectClient } from './client';

const TOKEN_VALIDATION_API_URL = process.env.TOKEN_VALIDATION_API_URL || 'https://api.example.com/validate-token';


export default async function ConnectPage() {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7); // "Bearer ".length
  } else {
     if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: No auth header found, using mock token.");
        // In development, we can use a mock token or directly a mock phone number
        // For simplicity here, we'll pass a mock token that the client can handle.
        token = 'dev-mode-token'; 
    }
  }

  return <ConnectClient token={token} validationApiUrl={TOKEN_VALIDATION_API_URL} />
}
