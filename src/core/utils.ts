/**
 * This module contains several utility functions.
 */

import winston = require('winston');

export namespace utils {

    var RAND_DICT: string = 'ASDFGHJKLQWERTZUIOPYXCVBNM1234567890';

    /**
     * Just generates a random string based on the defined length.
     */
    export function random_string(length: number = 10): string {
        var rand: string = '';
        for (var i = 0; i < length; i++) {
            rand += RAND_DICT.charAt(Math.floor(Math.random() * RAND_DICT.length));
        }

        return rand;
    };

    var loggerFormatter = (options: any) => {
        var message = options.message || '';
        var meta = Object.keys(options.meta).length ? '-' + JSON.stringify(options.meta) : '';

        if (meta.length > 100) {
            meta = meta.substring(0, 100) + '...';
        }

        return `${options.timestamp()} [${options.level.toUpperCase()}] - ${options.label}: ${message}${meta}`;
    };

    var loggerTimestampGetter = () => {
        return (new Date()).toISOString();
    };

    /**
     * Creates a logger using some default transporters.
     */
    export function create_logger(label: string): winston.LoggerInstance {

        var transporters: Array<winston.TransportInstance> = [];

        transporters.push(new winston.transports.Console({
            json: false,
            timestamp: loggerTimestampGetter,
            level: winston.level,
            formatter: loggerFormatter,
            label: label
        }));

        transporters.push(new winston.transports.File({
            json: false,
            timestamp: loggerTimestampGetter,
            level: 'debug',
            filename: '/tmp/webshutter.log',
            formatter: loggerFormatter,
            label: label
        }));

        var logger = new winston.Logger({
            transports: transporters
        });

        return logger;
    }
}
