type VerifyEmailTextParams = {
  name: string;
  verification_token: string;
  hostname: string;
  email: string;
};

export function createVerifyEmailText(params: VerifyEmailTextParams): string {
  return `Hi ${params.name},

Thanks for signing up for Close Powerlifting! Please verify your email address to get started:

${params.hostname}/verify-email?token=${params.verification_token}&email=${params.email}

Once verified, you'll receive your API key to access powerlifting data from around the world.

If you didn't create this account, you can safely ignore this email.

Cheers,
The Close Powerlifting Team
`;
}
