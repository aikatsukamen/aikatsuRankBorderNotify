'use strict';

var log4js = require('log4js');
const config = require('../config/log4js');

log4js.configure(config.log4js);

module.exports = {
  system: log4js.getLogger('system')
};
