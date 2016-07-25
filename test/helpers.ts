/**
 * Module to provide some helpers/shortcuts to the testers.
 */

import {config} from '../src/core';

export function create_configuration(): config.Interface {

    return {
        http: {
            port: 8181,
            host: 'localhost'
        },
        redis: {
            host: 'localhost',
            port: 6631,
            db: 10
        },
        components: [
            './../test/fixtures/testcomp'
        ]
    };
}
