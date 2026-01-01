type VerifyEmailTextParams = {
  name: string;
  verification_token: string;
  hostname: string;
  email: string;
};

export function createVerifyEmailText(params: VerifyEmailTextParams): string {
  return `Hi ${params.name},

We're happy you signed up for Close Powerlifting. To start exploring, please confirm your email address.

Verify your email: ${params.hostname}/verify-email?token=${params.verification_token}&email=${params.email}

Welcome to Close Powerlifting!

- The Close Powerlifting Team
`;
}
