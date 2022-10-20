import { MongoClient } from 'mongodb';
import { MONGODB_URI } from '../config/constants';

export const client = new MongoClient(MONGODB_URI!);
export const db = client.db();
