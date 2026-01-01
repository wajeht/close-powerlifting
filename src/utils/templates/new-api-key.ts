type NewApiKeyParams = {
  name: string;
  key: string;
};

export function createNewApiKeyText(params: NewApiKeyParams): string {
  return `Hi ${params.name},

We've received a request to reset your API key. Here is your new API key to access Close Powerlifting:

API Key: ${params.key}

Note: This API key will expire after three months. Please make sure to renew your key before it expires to continue accessing Close Powerlifting.

- The Close Powerlifting Team
`;
}
