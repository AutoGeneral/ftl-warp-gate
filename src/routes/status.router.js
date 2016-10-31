const FIELDS_TO_MASK = [
	'accessKeyId',
	'secretAccessKey',
	'password',
	'accountId'
];

const assert = require('assert');
const logger = require('winston');

const {ResponseHelpers} = require('../helpers');
const Jira = require('../core/jira');
const Bamboo = require('../core/bamboo');


class StatusRouter {

	constructor (app) {
		assert(app.config.properties, 'Properties are not defined');
		this._config = app.config;
		this._server = app.server;
		this._jira = new Jira(app.config.jira);
		this._bamboo = new Bamboo(app.config.bamboo);

		/**
		 * @api {get} /api/status Status
		 * @apiName Status
		 * @apiGroup Information
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Get current Warp Gate status and configuration information
		 */
		app.server.get('/api/status', this.status.bind(this));

		logger.debug('StatusRouter has been loaded');
	}

	/**
	 * @description
	 * Searches for the project version (fixVersion) that contain the issue and mark it as released
	 * Please note: this method will throw error if issue belongs to multiple versions
	 *
	 * @param {Object} req
	 * @param {Object} res
	 * @return {*}
     */
	status (req, res) {

		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'X-Requested-With');

		const sanitisedConfig = ResponseHelpers.maskFields(JSON.parse(JSON.stringify(this._config)), FIELDS_TO_MASK);
		const properties = Object.assign({}, sanitisedConfig.properties);
		delete sanitisedConfig.properties;

		ResponseHelpers.success(res, {
			status: 'ok',
			applicationName: 'FTL Warp Gate',
			config: sanitisedConfig,
			properties: properties,
			routes: Object.keys(this._server.router.mounts).map(key => this._server.router.mounts[key].spec)
		});
	}
}

module.exports = StatusRouter;
