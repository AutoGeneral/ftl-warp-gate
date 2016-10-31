const HTTP_METHOD = require('../constants').HTTP_METHOD;
const COLOUR = require('../constants').COLOUR;

// JSON file with information about production colours contains datetime field
// with the time when it was updated. Later we will check if that file was updated
// recently or not. If currentDate - DATA_INVALIDATION_TIMEOUT > fileLastUpdatedTime
// then we will ignore information from file and throw an error as it is unsafe
// to deploy
// Set a value carefully. Eg. if we update data every hour - set it to 70 min here
// to have some kind of failsafe if task will be executed a bit late
const DATA_INVALIDATION_TIMEOUT = 70; // minutes

const assert = require('assert');
const request = require('request-promise');
const logger = require('winston');
const moment = require('moment');


/**
 * @class
 * @description
 * Goal of this class is to provide an ability to get current production stack colour
 * and do it relatively safely
 */
class ProductionColourResolver {

	constructor (url) {
		assert(url, 'URL for ProductionColourResolver is not defined');
		this._url = url;
	}

	/**
	 * @description
	 * As we don't have F5 Big IP API to get data about our current active production colour
	 * we're going to use JSON file generated by one of our scripts that is scraping F5 every
	 * few minutes.
	 *
	 * Link to scraper:
	 * http://gitstash/projects/AGIC/repos/website-launcher/browse/scripts/get_production_colour.js
	 *
	 * Here is an example part from that JSON:
	 * {
	 *		...
	 *		"isGreen": true,
	 *		"isBlue": false,
	 *		"time": "2016-08-01T04:00:09.781Z"
	 *	}
	 *
	 * @return {Promise} with colour (type String) as a resolved value
     */
	getColour () {
		logger.debug(`ProductionColourResolver::getColour executed`);
		return new Promise((resolve, reject) => {
			request({
				uri: this._url,
				method: HTTP_METHOD.GET,
				json: true
			})
			.then(data => {
				assert(ProductionColourResolver.isDataValid(data), 'Info about production colours is too old');

				if (data.isGreen) {
					return resolve(COLOUR.GREEN);
				}
				else if (data.isBlue) {
					return resolve(COLOUR.BLUE);
				}

				logger.error('Info about current production colours is weird', data);
				reject();
			})
			.catch(err => {
				logger.error('Can\'t get info about current production colours', err);
				reject();
			});
		});
	}

	/**
	 * @description
	 * Validates data about colour state
	 *
	 * @param {Object} data
	 * @return {boolean}
     */
	static isDataValid (data) {
		logger.debug(`Executed`);
		if (!data || !data.time) return false;
		if (data.isGreen && data.isBlue) return false; // environment switch in progress
		return moment().diff(moment(data.time), 'minutes') < DATA_INVALIDATION_TIMEOUT;
	}
}

module.exports = ProductionColourResolver;
