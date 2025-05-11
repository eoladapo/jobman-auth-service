import { winstonLogger } from '@eoladapo/jobman-shared';
import { Logger } from 'winston';
import { config } from '@auth/config';
import { Sequelize } from 'sequelize';

const log: Logger = winstonLogger(`${config.ELASTIC_SEARCH_URL}`, 'authenticationDatabaseServer', 'debug');

export const sequelize: Sequelize = new Sequelize(process.env.MYSQL_DB!, {
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    multipleStatements: true
  }
});

export async function databaseConnection(): Promise<void> {
  try {
    await sequelize.authenticate();
    log.info('Auth Service - Successfully connected to database');
  } catch (error) {
    log.error('Auth Service - Unable to connect to database', error);
    log.log('error', 'Auth Service databaseConnection() method:', error);
  }
}
