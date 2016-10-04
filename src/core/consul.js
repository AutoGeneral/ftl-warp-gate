const consul = require('consul')();
const logger = require('winston');

class Cosnul {

	static register (name, port) {

		const data = {
			name,
			port,
			check: {
				interval: '15s'
			}
		};

		Cosnul.getIPAddress()
			.then(address => {
				data.address = address;
				data.check.http = `http://${address}:${data.port}/api/status`;
				return Cosnul.sendRequestToConsul(data);
			})
			.then(() => {
				logger.info(`Service registered in Consul cluster with IP: ${data.address}`);
			})
			.catch(err => {
				logger.warn(`Service failed registration in Consul cluster: ${err}`);
				logger.debug(err);
			});
	}

	static sendRequestToConsul (data) {
		return new Promise((resolve, reject) => {
			consul.agent.service.register(data, (err) => {
				if (err) reject(err);
				resolve();
			});
		});
	}

	static getIPAddress () {
		return new Promise((resolve, reject) => {
			require('dns').lookup(require('os').hostname(), (err, address) => {
				if (err) return reject(err);
				resolve(address);
			});
		});
	}
}

module.exports = Cosnul;
