import { User } from '../views/views.models';
import { ResourceFunction } from './admin';

export const CreateUserResource: ResourceFunction<typeof User> = () => ({
  resource: User,
  features: [],
  options: {
    navigation: 'User',
    properties: {
      _id: {
        isTitle: true,
      },
    },
  },
});
