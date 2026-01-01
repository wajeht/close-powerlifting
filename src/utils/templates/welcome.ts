type WelcomeParams = {
  name: string;
  key: string;
};

export function createWelcomeText(params: WelcomeParams): string {
  return `Hi ${params.name},

Thank you for verifying your email address. Below is your API key to access Close Powerlifting:

API Key: ${params.key}

Note: This API key will expire after three months. Please make sure to renew your key before it expires to continue accessing Close Powerlifting.

Welcome to Close Powerlifting!

- The Close Powerlifting Team
`;
}
