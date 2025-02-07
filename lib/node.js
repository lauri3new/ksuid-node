const crypto = require('crypto');
const os = require('os');
const fs = require('fs')
const Id = require('./id');
const Instance = require('./instance');
const validation = require('./validation');

class Node {
	constructor(environment = 'prod', instance = getInstance()) {
		this.environment = environment;
		this.instance = instance;

		this._lastTimestamp = 0;
		this._currentSequence = 0;
	}

	get environment() {
		return this._environment;
	}

	set environment(value) {
		validation.checkPrefix('environment', value);

		this._environment = value;
	}

	get instance() {
		return this._instance;
	}

	set instance(value) {
		validation.checkClass('instance', value, Instance);

		this._instance = value;
	}

	generate(resource) {
		if (typeof resource !== 'string')
			throw new Error('resource must be a string');

		if (!resource)
			throw new Error('resource must not be empty');

		const now = Math.floor(Date.now() / 1000);

		if (this._lastTimestamp >= now) {
			this._currentSequence += 1;
		} else {
			this._lastTimestamp = now;
			this._currentSequence = 0;
		}

		return new Id(
			this.environment,
			resource,
			this._lastTimestamp,
			this.instance,
			this._currentSequence
		);
	}
}

module.exports = Node;

function getInstance() {
	let id = null;

	if((id = getDockerInstance()))
		return id;

	if ((id = getMacPidInstance()))
		return id;

	return new Instance(Instance.schemes.RANDOM, crypto.randomBytes(8));
}

function getMacPidInstance() {
	const interfaces = [].concat(...objectValues(os.networkInterfaces()));
	const int = interfaces.find(i => !i.internal && i.mac !== '00:00:00:00:00:00');

	if (!int)
		return null;

	const buf = Buffer.alloc(8);

	buf.write(int.mac.replace(/:/g, ''), 0, 6, 'hex');
	buf.writeUInt16BE(process.pid % 65536, 6);

	return new Instance(Instance.schemes.MAC_AND_PID, buf);
}

function getDockerInstance() {
	try {

	const src = fs.readFileSync('/proc/1/cpuset', 'utf-8')
	const id = src.trim().split('/docker/').pop()

	if (!id || id.length < 64)
		return null

	const buf = Buffer.alloc(8)

	buf.write(id, 0, 8, 'hex')

	return new Instance(Instance.schemes.DOCKER_CONT, buf)

	} catch (e) {
		
		return null

	}
}

function objectValues(obj) {
	return Object.keys(obj).map(k => obj[k]);
}
