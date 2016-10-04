'use strict';

const path = require('path');
const Application = require('./src/app');

const configPath = process.env.config.replace('./', __dirname + '/') || `${__dirname}/config/default.json`;
const app = new Application(path.normalize(configPath));
app.start();

