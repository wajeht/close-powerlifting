import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import db from '../db.json';

interface User {
  email: string;
  key: string;
  deleted: boolean;
  created_at: string;
}

type Key = {
  [key: string]: User;
};

export default class Keys {
  private static db: Key = db;
  private static crypto = crypto;
  private static bcrypt = bcrypt;
  private static fs = fs;
  private static filePath = path.resolve(path.join(process.cwd(), 'src', 'db.json'));

  /**
   * It generates a random key, hashes it, and returns both the key and the hashed key
   * @returns An object with two properties: key and hashedKey.
   */
  private static async hashKey() {
    const key = this.crypto.randomUUID();
    const hashedKey = await this.bcrypt.hash(key, 5);
    return {
      key,
      hashedKey,
    };
  }

  /**
   * It writes the database to a file, then reads it back in
   * @returns The read file is being returned.
   */
  private static async store() {
    try {
      const create = await this.fs.writeFile(this.filePath, JSON.stringify(this.db));
      const read = await this.fs.readFile(this.filePath, 'utf-8');
      return read;
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * It returns true if the email exists in the database, and false if it doesn't
   * @param {string} email - string - The email address to search for
   * @returns A boolean value.
   */
  public static async find(email: string): Promise<boolean> {
    if (this.db[email]) {
      return true;
    }
    return false;
  }

  /**
   * It creates a new user in the database
   * @param {string} email - string - the email address of the user
   * @returns The un-hashed key
   */
  public static async create(email: string): Promise<User> {
    const { key, hashedKey } = await this.hashKey();

    const newUser = {
      email: email,
      key: hashedKey,
      deleted: false,
      created_at: new Date().toISOString().toString(),
    };

    this.db[email] = newUser;

    this.store();

    // return back the un-hashed key
    newUser.key = key;

    return newUser;
  }
}

// (async () => {
//   try {
//     const user = await Keys.find('emaiwl@gxmail.com');

//     if (user) {
//       throw new Error('User already exist!');
//     }
//     const created = await Keys.create('email@gmail.com');

//     console.log(created);
//   } catch (e) {
//     console.log(e);
//   }
// })();