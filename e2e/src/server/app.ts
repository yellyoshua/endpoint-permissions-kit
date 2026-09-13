import express, { type ErrorRequestHandler, type Express } from 'express';
import './bootstrap';
import { INVALID_BODY_CODE } from './errors';
import smallRouter from '../project-small/server/routes';
import mediumRouter from '../project-medium/server/routes';
import largeRouter from '../project-large/server/routes';
import extraLargeRouter from '../project-extra-large/server/routes';

const rejectMalformedJson: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: { code: INVALID_BODY_CODE, message: 'malformed JSON body' } });
    return;
  }
  next(error);
};

export default function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(rejectMalformedJson);
  app.use('/api/small', smallRouter);
  app.use('/api/medium', mediumRouter);
  app.use('/api/large', largeRouter);
  app.use('/api/extra-large', extraLargeRouter);
  return app;
}
