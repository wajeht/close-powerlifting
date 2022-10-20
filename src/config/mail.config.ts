import { EMAIL } from './constants';

export default {
  host: EMAIL.HOST as unknown as string,
  port: EMAIL.PORT as unknown as number,
  auth: {
    user: EMAIL.AUTH_EMAIL as unknown as string,
    pass: EMAIL.AUTH_PASS as unknown as string,
  },
};
