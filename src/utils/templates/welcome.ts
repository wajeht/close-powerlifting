type WelcomeTextParams = {
  name: string;
  key: string;
};

export function createWelcomeText(params: WelcomeTextParams): string {
  return `Hi ${params.name},

You're all set! Your email has been verified and your API key is ready:

API Key: ${params.key}

Your key expires in 3 months. We'll send you a reminder before it does.

Check out our documentation to get started: https://close-powerlifting.com/docs

Happy lifting!
The Close Powerlifting Team
`;
}
