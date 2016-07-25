#!/usr/bin/env node
/**
 * The main file to run the service by execute different actions.
 */

import argparse = require('argparse');
import winston = require('winston');
import path = require('path');

import {server, queue, worker} from '../core';

/**
 * Parse the arguments of the command line and return the args.object
 */
var parse_args = () => {

    var parser = new argparse.ArgumentParser({
        version: '0.0.1',
        addHelp: true,
        description: 'NIMP'
    });

    var subparser = parser.addSubparsers({
        title: 'start crawler cluster'
    });

    var http_parser = subparser.addParser('http');
    http_parser.setDefaults({action: 'http'});

    var render_worker_parser = subparser.addParser('worker');
    render_worker_parser.setDefaults({action: 'worker'});

    var std_parsers: Array<argparse.ArgumentParser> = [
        http_parser, render_worker_parser
    ];

    std_parsers.forEach( (_parser) => {
        _parser.addArgument(['-v'], {
            action: 'count',
            defaultValue: 0
        });

        _parser.addArgument(['--settings'], {
            defaultValue: './config.json'
        });
    } );

    return parser.parseArgs();
};

/**
 * Method to get the configuration object.
 */
var getConfig = (settings: string) => {

    var config_file = path.join(process.cwd(), settings);
    return require(config_file);
};

/**
 * The error handler for errors, used in promise.catch.
 */
var errorHandler = (err: Error) => {

    console.error(err.message);
    process.exit(3);
};

var terminateSignal = (service: any) => {
    console.log('shutdown gracefully ...');
    service.stop().then(() => {
        console.log('done.');
        process.exit(0);
    }).catch(errorHandler);
};

/**
 * Action function to launch the http-server.
 */
var action_http = (args: any) => {

    var config = getConfig(args.settings);
    var _server = new server.Webshutter(config);

    _server.start().catch( errorHandler );

    process.on('SIGTERM', terminateSignal.bind(null, _server));
    process.on('SIGINT', terminateSignal.bind(null, _server));
};

/**
 * Action function to run the processor components using
 * a worker.Launher.
 */
var action_worker = (args: any) => {
    var config = getConfig(args.settings);
    var launcher = new worker.Launcher(config);

    launcher.start().catch( errorHandler );

    process.on('SIGTERM', terminateSignal.bind(null, launcher));
    process.on('SIGINT', terminateSignal.bind(null, launcher));
};

var main = () => {
    var args = parse_args();

    var actions: any = {
        'http': action_http,
        'worker': action_worker
    };

    var LOG_LEVELS: any = {
        0: 'error',
        1: 'warn',
        2: 'info',
        3: 'debug'
    };

    winston.level = LOG_LEVELS[args.v];
    var action = actions[args['action']];

    action(args);
};

main();
