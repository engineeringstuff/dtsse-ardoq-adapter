import { ArdoqClient } from '../modules/ardoq/ArdoqClient';
import { GradleParser } from '../modules/ardoq/GradleParser';
import { MavenParser } from '../modules/ardoq/MavenParser';
import { RequestProcessor } from '../modules/ardoq/RequestProcessor';

import axios from 'axios';
import config from 'config';
import { Application } from 'express';

export default function (app: Application): void {
  const client = new ArdoqClient(
    axios.create({
      baseURL: config.get('ardoq.apiUrl'),
      headers: {
        Authorization: 'Token token=' + config.get('ardoq.apiKey'),
      },
    }),
    config.get('ardoq.apiWorkspace')
  );
  const requestProcessor = new RequestProcessor(client);

  app.post('/api/gradle/:repo', async (req, res) => {
    if (String(req.body) === '') {
      return res.status(400).send('No body');
    }
    try {
      return requestProcessor.processRequest(res, GradleParser.fromDepString(String(req.body)));
    } catch (e) {
      return res.status(400).contentType('text/plain').send(e.message);
    }
  });

  app.post('/api/maven/:repo', async (req, res) => {
    if (String(req.body) === '') {
      return res.status(400).send('No body');
    }
    try {
      return requestProcessor.processRequest(res, MavenParser.fromDepString(String(req.body)));
    } catch (e) {
      return res.status(400).contentType('text/plain').send(e.message);
    }
  });
}
