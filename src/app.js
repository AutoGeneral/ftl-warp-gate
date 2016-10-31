const ROUTERS_PATH = `${__dirname}/routes`;
const PROPERTIES_FILENAME = '../resources/properties.json';
const PROPERTIES_SCHEMA_FILENAME = '../resources/properties.schema.json';
const ERROR = require('./constants').ERROR;
const APP_NAME = 'FTLWarpGateService';

const tv4 = require('tv4');
const restify = require('restify');
const fs = require('fs');
const assert = require('assert');
const Consul = require('./core/consul');


class Application {

	/**
	 * @param {String} configName
     */
	constructor (configName) {
		try {
			this._config = require(configName);
			this._config.debug = this._config.debug || {};
		}
		catch (ex) {
			console.error(`Error! Cannot find config file '${process.env.config}'. Existing now...`, ex); // eslint-disable-line no-console
			process.exit(1);
		}

		this._logger = require('./core/logging')(this._config);
		this._config.properties = this.readProperties(PROPERTIES_FILENAME, PROPERTIES_SCHEMA_FILENAME);
		Object.freeze(this._config);

		// Setup server
		this._server = restify.createServer({});
		this._server.use(restify.bodyParser({mapParams: true}));
		this._server.use(restify.queryParser());

		// Global uncaughtException Error Handler
		this._server.on('uncaughtException', (req, res, route, error) => {
			this._logger.warn('uncaughtException', route, error.stack.toString());

			res.send(500, {
				error: ERROR.INTERNAL,
				status: 'error'
			});
		});

		// Add debug logger to endpoints
		this._server.use((req, res, next) => {
			this._logger.debug(`${req.method} ${req.url}`);
			return next();
		});

		// Load routing
		this.loadRouters(ROUTERS_PATH);

		// Register in service discovery
		Consul.register(APP_NAME, this._config.server.port);
	}

	get config () {
		return this._config;
	}

	get server () {
		return this._server;
	}

	/**
	 * @description
	 * Loads and inits routers from the specified path
	 *
	 * @param {String} routersPath
     */
	loadRouters (routersPath) {
		fs.readdirSync(routersPath)
			.filter(filename => /.*\.router\.js/.test(filename))
			.forEach(filename => new (require(`${ROUTERS_PATH}/${filename}`))(this));
	}

	/**
	 * @description
	 * Reads properties configuration file and validates it against JSON schema
	 *
	 * @param {String} propertiesFileName
	 * @param {String} propertiesSchemaFileName
	 * @return {Object} properties
     */
	readProperties (propertiesFileName, propertiesSchemaFileName) {
		this._logger.info('Validating properties configuration file');

		const properties = require(propertiesFileName);
		const propertiesSchema = require(propertiesSchemaFileName);
		const valid = tv4.validate(properties, propertiesSchema);

		assert(valid, tv4.error);
		return properties;
	}

	start () {
		this._server.listen(
			this._config.server.port || 8080,
			this._config.server.host || 'localhost',
			() => this._logger.info('Server is listening at %s', this._server.url)
		);
	}
}

module.exports = Application;
