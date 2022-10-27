import cron from 'node-cron';
// @ts-ignore
import redis from './redis';

function removeCaches() {
  // @ts-ignore
  redis.keys('*', function (err, keys) {
    if (err) return null;
    keys.forEach((key: any) => {
      if (key.match(/close-powerlifting.+/g)) {
        // @ts-ignore
        console.log(`deleted redis cache ${key}!`);
        // redis.del(key);
      }
    });
  });
}

export async function init() {
  console.log(`cron services were started!`);

  // everyday at mid night
  cron.schedule('0 0 * * *', removeCaches).start();
}
