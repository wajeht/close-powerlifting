import { emailConfig } from './constants';

export default {
  host: emailConfig.host as unknown as string,
  port: emailConfig.port as unknown as number,
  auth: {
    user: emailConfig.auth_email as unknown as string,
    pass: emailConfig.auth_pass as unknown as string,
  },
} as const;
