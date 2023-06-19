type param = {
  name: string;
  password: string;
  apiKey: string;
};

export default function adminNewAPIKeyHTML(param: param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>
    <p>Here below is your API key and admin password to access Close Powerlifting!</p>
    <br>
    <br>
    <p>Admin password</p>
    <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${param.password}</div>
    <br>
    <p>API Key:</p>
    <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${param.apiKey}</div>
    <br>
    <br>
    <br>
    <p>Welcome to the Close Powerlifting,</p>
    <p>Let's make all kinds of gains. All kindszzzz.!</p>
  </div>
  `;
}
