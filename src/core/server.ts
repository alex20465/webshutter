/**
 * This module contains a simple extendible http-server using express.
 */

import express = require('express');
import http = require('http');
import q = require('q');

import {queue} from './queue';
import {config} from './config';
import {component} from './component';


export namespace server {

    /**
     * Simple HTTPServer base.
     */
    export class Base {

        /**
         * The express application instance.
         */
        protected app: express.Application;

        /**
         * The http.server instance of the express application.
         */
        protected server: http.Server;

        /**
         * The used configuration instance for this server start-up.
         */
        protected config: config.Interface;

        /**
         * constructor.
         */
        constructor(config: config.Interface) {

            config = config || {};
            config.http = config.http || (<any>{});
            this.config = config;

            this.app = express();
            this.registerRoutes();
        }

        /**
         * Start the http-server and resolve promise.
         *
         * @Todo: test the reject behaviour. (just already bind port)
         */
        start(): q.Promise<any> {
            var d = q.defer();
            var http = this.config.http;

            this.server = this.app.listen(http.port, http.host, (err: Error) => {
                if (err) {
                    d.reject(err);
                } else {
                    d.resolve();
                }
            });

            return d.promise;
        }

        /**
         * Stop the http-server and resolve.
         */
        stop(): q.Promise<any> {
            var d = q.defer();

            this.server.on('close', () => {
                d.resolve();
            });

            this.server.close();

            return d.promise;
        }

        /**
         * The summary method to register routes to methods of this class.
         */
        protected registerRoutes() {
            //
        }
    }

    /**
     * The application http-server.
     */
    export class Webshutter extends Base {

        /**
         * Component instances container.
         */
        protected components: Array<component.action.Base>;

        /**
         * constructor
         */
        constructor(config: config.Interface) {
            super(config);
        }

        /**
         * Method to register routes using a component manager and load
         * component instances: component.action.Base.
         */
        protected registerRoutes() {

            // register base routes
            super.registerRoutes();

            this.components = [];

            var action_manager = new component.Manager(this.config);
            action_manager.load();
            var action_components = action_manager.findBy(component.action.Base);

            action_components.forEach( (Component: any) => {

                var component: component.action.Base = new Component(this.config);
                var action_com: component.action.Interface = <any>component;
                component.setServer(this);

                this.app.get(action_com.ROUTE, (req: express.Request, res: express.Response) => {
                    component.setRequest(req);
                    component.setResponse(res);
                    action_com.action();
                });

                this.components.push(component);
            } );
        }

        /**
         * Component container getter.
         */
        public getComponents() {
            return this.components;
        }
    }
}
