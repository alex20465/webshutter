/// <reference path="../../typings/jasmine/jasmine.d.ts" />

import request = require('request');
import {webphantom} from '../../src/components/webphantom';
import {devices, queue, server, config, worker} from '../../src/core';
import {create_configuration} from '../helpers';

describe('webphantom-producer', () => {

    var producer: webphantom.Producer;
    var q: queue.Mock;

    beforeEach( (done) => {
        producer = new webphantom.Producer({
            device: devices.INDEX.LAPTOP,
            url: 'http://www.google.de'
        });

        q = new queue.Mock();

        q.connect().then(done);
    } );

    afterEach( (done) => {

        q.disconnect().then(done);
    } );

    it( 'should put jobs into the queue', (done) => {

        var submitted_jobs: Array<webphantom.Job> = [];

        producer.submit(q)
            .progress((dump: any) => {
                submitted_jobs.push(dump);
            })
            .then(() => {
                expect(submitted_jobs.length).toBe(1);
                done();
            })
            .catch((err) => {
                producer.errors.forEach( (err) => {
                    expect(false).toBeTruthy(err.message);
                } );
                expect(false).toBeTruthy(err.message);
                done();
            });

           setTimeout( () => {
               let job: string = q.queues[producer.DESTINATION].pop();

               q.put(producer.SOURCE + producer.hash, job);
           }, 100);
    } );
});

describe('webphantom-action-component', () => {

    var serv: server.Webshutter;
    var q: queue.Mock;

    beforeEach( (done) => {
        // patch queue
        (<any>webphantom.ActionComponent).createQueue = () => {
            q = new queue.Mock();
            return q;
        };

        var config = create_configuration();
        config.components = [
            './components/webphantom'
        ];

        serv = new server.Webshutter(config);
        serv.start().then(done);
    } );

    afterEach( (done) => {

        serv.stop().then(done);
    } );

    it( 'should put a unfinished job, when receive render request', (done) => {
        request.get('http://localhost:8181/render?url=http://google.com', (err: Error, res: any) => {
            //
        });
        setTimeout( () => {
            var comp: webphantom.ActionComponent = <any>serv.getComponents()[0];
            expect(q.queues['RENDER:UNF']).toBeDefined();
            expect(q.queues['RENDER:UNF'].length).toBe(1);
            q.disconnect().then(done);
        }, 200);
    } );
});

describe('webphantom-worker-component', () => {

    var launcher: worker.Launcher;
    var q: queue.Interface;

    beforeEach( () => {

        var config = create_configuration();
        config.components = [
            './components/webphantom'
        ];

        q = new queue.Mock();
        launcher = new worker.Launcher(config);

        launcher.setUsedQueue(q);
        launcher.start();
    } );

    afterEach( () => {

        launcher.stop();
    } );

    it( 'should render the url and put the results to the finish queue', (done) => {
        q.put('RENDER:UNF', JSON.stringify({
            'producer_id': 'test',
            'params': {
                'url': 'http://google.com'
            }
        }));

        q.get('RENDER:FIN:test')
            .progress((control: queue.Control) => {
                expect(control.target.length).toBeGreaterThan(1000);
                control.break();
            })
            .then(done);
    } );
});
