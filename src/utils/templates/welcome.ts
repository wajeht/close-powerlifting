type Param = {
  name: string;
  key: string;
};

export function createWelcomeHtml(param: Param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>

    <p>Thank you for verifying your email address. Below is your API key to access Close Powerlifting!</p>

    <br>
    <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${param.key}</div>
    <br>

    <p>Note: This API key will expire after three months. Please make sure to renew your key before it expires to continue accessing Close Powerlifting.</p>

    <br>
    <p>Welcome to Close Powerlifting!</p>
    <p>Let's make all kinds of gains. All kindszzzz!</p>
    <br>
  </div>
  `;
}
