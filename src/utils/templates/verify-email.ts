type param = {
  name: string;
  verification_token: string;
  hostname: string;
  email: string;
};

export function createVerifyEmailHtml(param: param): string {
  return `
    <div>
      <p>Hi ${param.name},</p>
      <br>

      <p>We're happy you signed up for Close Powerlifting. To start exploring, please confirm your email address.</p>

      <br>
        <a href="${param.hostname}/verify-email?token=${param.verification_token}&email=${param.email}" style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">Verify Now</a>
      <br>

      <br>
      <p>Welcome to the Close Powerlifting,</p>
      <p>Let's make all kinds of gains. All kindszzzz.!</p>
    </div>
  `;
}
