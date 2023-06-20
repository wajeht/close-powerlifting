// @ts-ignore
import redis from '../utils/redis';
import { User } from '../views/views.models';
import { sendVerificationEmail } from '../views/views.services';
import { ResourceFunction } from './admin';

export const CreateUserResource: ResourceFunction<typeof User> = () => ({
  resource: User,
  features: [],
  options: {
    navigation: {
      name: 'Users',
      icon: 'User',
    },
    sort: {
      sortBy: 'createdAt',
      direction: 'desc',
    },
    // listProperties: ['id', 'name', 'createdAt'],
    // editProperties: ['id', 'name', 'bio', 'createdAt'],
    // showProperties: ['id', 'name', 'email', 'api_call_count'],
    filterProperties: ['name', 'email'],
    listProperties: ['name', 'email', 'api_call_count', 'verified'],
    actions: {
      sendVerificationEmail: {
        actionType: 'record',
        component: false,
        handler: async (request, response, context) => {
          const { record, currentAdmin } = context;

          // @ts-ignore
          const hostname = await redis.get('hostname');

          await sendVerificationEmail({
            hostname,
            email: record?.params.email,
            name: record?.params.name,
            userId: record?.params.id,
            verification_token: record?.params.verification_token,
          });

          return {
            record: record!.toJSON(currentAdmin),
          };
        },
        isAccessible: ({ record }) => !record?.params.verified,
      },
    },
  },
});
