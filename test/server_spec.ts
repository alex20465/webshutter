/// <reference path="../typings/jasmine/jasmine.d.ts" />

import request = require('request');
import express = require('express');

import {create_configuration} from './helpers';
import {server} from '../src/core';

describe('webshutter-server', () => {

    var serv: server.Webshutter;

    beforeEach( (done) => {

        serv = new server.Webshutter(create_configuration());

        serv.start().then(done).catch(done);
    } );

    afterEach( (done) => {
        serv.stop().then(done).catch(done);
    } );

    it('should start and return 404', (done) => {
        request.get('http://localhost:8181/404', (err, res) => {
            expect(err).toBeNull();
            expect(res).toBeDefined();
            if (res) {
                expect(res.statusCode).toBe(404);
            }
            done();
        });
    });


    it('should receive "foo" with status 200 when request /test', (done) => {
        request.get('http://localhost:8181/test', (err, res, body) => {
            expect(err).toBeNull();
            expect(res).toBeDefined();
            if (res) {
                expect(res.statusCode).toBe(200);
            }
            expect(body).toBe('foo');
            done();
        });
    });
});
