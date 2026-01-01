type param = { name: string };

export function createApiLimitResetHtml(param: param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>

    <p>Your API call limit has been reset. You can now continue using our services without restrictions.</p>

    <br>
    <p>Thank you for using Close Powerlifting Api</p>
    <p>Let's make all kinds of gains. All kindszzzz.!</p>
  </div>
  `;
}
