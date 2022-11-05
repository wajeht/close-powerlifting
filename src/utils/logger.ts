import pino from 'pino';
import pretty from 'pino-pretty';
import path from 'path';

const today = new Date().toISOString().split('T')[0];
const root = path.resolve(process.cwd());

const levels = {
  // emerg: 80,
  // alert: 70,
  // crit: 60,
  // error: 50,
  // warn: 40,
  // notice: 30,
  // info: 20,
  // debug: 10,
};

const streams = [
  { stream: pino.destination(`${root}/logs/${today}.log`) },
  // // this will print to the console
  {
    stream: pretty({
      translateTime: 'yyyy-mm-dd HH:MM:ss TT',
      colorize: true,
      sync: true,
      ignore: 'hostname,pid',
    }),
  },
];

const logger = pino(
  {
    customLevels: levels,
    level: process.env.PINO_LOG_LEVEL || 'info',
    useOnlyCustomProps: true,
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(streams),
);

export default logger;
