import { CustomError, IAuthPayload, IErrorResponse, winstonLogger } from '@eoladapo/jobman-shared';
import { Logger } from 'winston';
import { config } from '@auth/config';
import { Application, json, NextFunction, Request, Response, urlencoded } from 'express';
import hpp from 'hpp';
import cors from 'cors';
import helmet from 'helmet';
import { verify } from 'jsonwebtoken';
import compression from 'compression';
import { checkConnection, createIndex } from '@auth/elasticsearch';
import http from 'http';
import { appRoutes } from '@auth/routes';
import { Channel } from 'amqplib';
import { createConnection } from '@auth/queues/connection';

const SERVER_PORT = 4002;
const log: Logger = winstonLogger(`${config.ELASTIC_SEARCH_URL}`, 'authenticationServer', 'debug');

export let authChannel: Channel;

export function start(app: Application): void {
  securityMiddleware(app);
  standardMiddleware(app);
  routesMiddleware(app);
  startQueues();
  startElasticSearch();
  authErrorHandler(app);
  startServer(app);
}

function securityMiddleware(app: Application): void {
  app.set('trust proxy', 1);
  app.use(hpp());
  app.use(helmet());
  app.use(
    cors({
      origin: config.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    })
  ),
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.headers.authorization) {
        const token = req.headers.authorization.split(' ')[1];
        const payload: IAuthPayload = verify(token, `${config.JWT_TOKEN}`) as IAuthPayload;
        req.currentUser = payload;
      }
      next();
    });
}

function standardMiddleware(app: Application) {
  app.use(compression());
  app.use(json({ limit: '200mb' }));
  app.use(urlencoded({ extended: true, limit: '200mb' }));
}

function routesMiddleware(app: Application): void {
  appRoutes(app);
}

async function startQueues(): Promise<void> {
  authChannel = (await createConnection()) as Channel;
}

function startElasticSearch(): void {
  checkConnection();
  createIndex('gigs');
}

function authErrorHandler(app: Application): void {
  app.use((error: IErrorResponse, _req: Request, res: Response, next: NextFunction) => {
    log.log('error', `AuthService ${error.comingFrom}: `, error);
    if (error instanceof CustomError) {
      res.status(error.statusCode).json(error.serializeErrors());
    }
    next();
  });
}

function startServer(app: Application): void {
  try {
    const httpServer: http.Server = new http.Server(app);
    log.info(`Authentication Server with process id ${process.pid} has started!`);
    httpServer.listen(SERVER_PORT, () => {
      log.info(`Authentication Server is listening on port ${SERVER_PORT}`);
    });
  } catch (error) {
    log.log('error', 'Auth Service startServer() method:', error);
  }
}
